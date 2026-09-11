// ============================================================
// api/store/checkout-session — Sprint 3F pemulihan troli terbengkalai (EMAIL).
//
// POST: tangkap snapshot troli + email/nama/telefon dari /checkout (tetamu &
//       member) sebaik email sah — fire-and-forget dari client, sentiasa
//       balas { ok } (termasuk bila migration 128 belum dijalankan).
//       Terbuka (guest boleh) → burst gate 20/IP/10min + honeypot (corak
//       order-guard). Senarai putih medan sahaja — TIADA data kad/bayaran.
// GET ?token=…: pulangkan item (produk/varian aktif sahaja, baris penuh untuk
//       useCartStore.addItem) + nama/email/telefon untuk pautan pemulihan
//       /checkout?recover=<token>. 404 bila token tak wujud / dah pulih /
//       luput (> 7 hari).
// ============================================================
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { safeClientIp, isHoneypotFilled } from '@/lib/order-guard'
import {
  isValidEmail, normalizeEmail, sanitizeSessionItems, sanitizeSubtotal,
  upsertCheckoutSession, isMissingTableError, isSessionExpired,
  MAX_NAME_LEN, TOKEN_RE, type CheckoutSessionRow, type CheckoutSessionItem,
} from '@/lib/checkout-session'

export async function POST(req: NextRequest) {
  const ip = safeClientIp(req)
  if (!rateLimit('cs:' + (ip ?? 'unknown'), 20, 10 * 60_000))
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  if (isHoneypotFilled(body)) {
    console.warn(`[order-guard] honeypot hit (checkout-session) ip=${ip}`)
    return NextResponse.json({ ok: true })
  }

  const { email, name, phone, items, subtotal } = (body ?? {}) as Record<string, unknown>
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Email tidak sah.' }, { status: 400 })
  if (name != null && (typeof name !== 'string' || name.length > 200))
    return NextResponse.json({ error: 'Nama tidak sah.' }, { status: 400 })
  if (phone != null && (typeof phone !== 'string' || phone.length > 30))
    return NextResponse.json({ error: 'Telefon tidak sah.' }, { status: 400 })
  const cleanItems = sanitizeSessionItems(items)
  if (!cleanItems) return NextResponse.json({ error: 'Item tidak sah.' }, { status: 400 })

  const res = await upsertCheckoutSession(createAdminClient(), {
    email: normalizeEmail(email),
    name: typeof name === 'string' ? name.slice(0, MAX_NAME_LEN) : null,
    phone: typeof phone === 'string' ? phone : null,
    items: cleanItems,
    subtotal: sanitizeSubtotal(subtotal, cleanItems),
    source: 'checkout',
  })
  // Best-effort untuk client: ralat DB pun balas ok (jangan ganggu checkout).
  if (!res.ok) console.warn(`[checkout-session] capture skipped: ${res.skipped}`)
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const ip = safeClientIp(req)
  if (!rateLimit('csg:' + (ip ?? 'unknown'), 30, 10 * 60_000))
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 })

  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: 'Token tidak sah.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('checkout_sessions')
    .select('id, email, name, phone, items, created_at, recovered_at')
    .eq('token', token)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return NextResponse.json({ error: 'Pautan tidak tersedia.' }, { status: 404 })
    return NextResponse.json({ error: 'Ralat pelayan.' }, { status: 500 })
  }
  const row = data as Pick<CheckoutSessionRow, 'id' | 'email' | 'name' | 'phone' | 'items' | 'created_at' | 'recovered_at'> | null
  if (!row || row.recovered_at || isSessionExpired(row))
    return NextResponse.json({ error: 'Pautan tidak sah atau sudah luput.' }, { status: 404 })

  const saved = (Array.isArray(row.items) ? row.items : []) as CheckoutSessionItem[]
  const productIds = [...new Set(saved.map((i) => i.product_id))]
  const variantIds = [...new Set(saved.map((i) => i.variant_id).filter((v): v is string => !!v))]

  const [productsRes, variantsRes] = await Promise.all([
    productIds.length ? admin.from('products').select('*').in('id', productIds).eq('is_active', true) : Promise.resolve({ data: [] }),
    variantIds.length ? admin.from('product_variants').select('*').in('id', variantIds).eq('is_active', true) : Promise.resolve({ data: [] }),
  ])
  const productMap = new Map(((productsRes.data ?? []) as { id: string }[]).map((p) => [p.id, p]))
  const variantMap = new Map(((variantsRes.data ?? []) as { id: string; product_id: string }[]).map((v) => [v.id, v]))

  // Produk/varian tidak aktif lagi → langkau (client papar bilangan dilangkau).
  const items: { product: unknown; variant: unknown; quantity: number }[] = []
  let skipped = 0
  for (const it of saved) {
    const product = productMap.get(it.product_id)
    if (!product) { skipped++; continue }
    let variant: unknown = null
    if (it.variant_id) {
      const v = variantMap.get(it.variant_id)
      if (!v || v.product_id !== it.product_id) { skipped++; continue }
      variant = v
    }
    items.push({ product, variant, quantity: it.qty })
  }

  return NextResponse.json({
    ok: true,
    name: row.name ?? null,
    email: row.email,
    phone: row.phone ?? null,
    items,
    skipped,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
