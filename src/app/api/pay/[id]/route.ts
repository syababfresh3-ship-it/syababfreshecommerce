import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Resume-payment link untuk order online (FPX/e-wallet) yang belum dibayar.
// Diletak dalam email reminder. orderId (UUID) bertindak sebagai token —
// jana SEMULA checkout Chip setiap kali supaya link tak pernah basi/luput,
// kemudian redirect terus ke gateway. Sah untuk storefront & LP guest order.

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

function getAppUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit && !explicit.includes('localhost')) return explicit
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return explicit ?? 'http://localhost:3006'
}

type ChipProduct = { name: string; price: number; quantity: number }

// Cipta purchase Chip, simpan payment_ref baharu, pulang checkout_url.
async function createCheckout(opts: {
  client: { email: string; full_name?: string; phone?: string }
  products: ChipProduct[]
  reference: string
  notes: string
  successUrl: string
  failureUrl: string
  cancelUrl: string
  appUrl: string
}): Promise<{ id: string; url: string } | null> {
  const res = await fetch(`${CHIP_API_URL}/purchases/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client: opts.client,
      purchase: { currency: 'MYR', products: opts.products, notes: opts.notes },
      brand_id: process.env.CHIP_BRAND_ID,
      reference: opts.reference,
      success_redirect: opts.successUrl,
      failure_redirect: opts.failureUrl,
      cancel_redirect: opts.cancelUrl,
      success_callback: `${opts.appUrl}/api/webhook/chip`,
      send_receipt: false,
    }),
  })
  if (!res.ok) {
    console.error('[pay] Chip API error', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = await res.json()
  return typeof data?.id === 'string' && typeof data?.checkout_url === 'string'
    ? { id: data.id, url: data.checkout_url }
    : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUrl = getAppUrl()
  const fail = NextResponse.redirect(`${appUrl}/?bayar=ralat`, 302)

  if (!process.env.CHIP_SECRET_KEY || !process.env.CHIP_BRAND_ID) return fail
  const supabase = createAdminClient()

  // ── 1) Storefront order ──────────────────────────────────────────────
  const { data: sf } = await supabase
    .from('orders')
    .select('id, order_number, total, delivery_fee, payment_status, payment_method, user_id, order_items(product_name, unit_price, quantity)')
    .eq('id', id)
    .maybeSingle()

  if (sf) {
    if (sf.payment_status === 'paid') return NextResponse.redirect(`${appUrl}/orders/${sf.id}`, 302)

    const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', sf.user_id).single()
    if (!profile?.email) return fail

    const products: ChipProduct[] = (sf.order_items as any[]).map((i) => ({
      name: i.product_name, price: Math.round(Number(i.unit_price) * 100), quantity: i.quantity,
    }))
    const deliveryFee = Number(sf.delivery_fee ?? 0)
    if (deliveryFee > 0) products.push({ name: 'Kos Penghantaran', price: Math.round(deliveryFee * 100), quantity: 1 })

    const out = await createCheckout({
      client: { email: profile.email, ...(profile.full_name ? { full_name: profile.full_name } : {}) },
      products, reference: sf.id, notes: sf.order_number,
      successUrl: `${appUrl}/orders/${sf.id}?new=1`,
      failureUrl: `${appUrl}/orders/${sf.id}?failed=1`,
      cancelUrl: `${appUrl}/orders/${sf.id}`,
      appUrl,
    })
    if (!out) return fail
    await supabase.from('orders').update({ payment_ref: out.id }).eq('id', sf.id)
    return NextResponse.redirect(out.url, 302)
  }

  // ── 2) LP guest order ────────────────────────────────────────────────
  const { data: lp } = await supabase
    .from('lp_guest_orders')
    .select('id, order_number, name, phone, total, delivery_fee, discount, points_discount, payment_status, items, product_name, variant_name, quantity, unit_price, landing_pages(slug)')
    .eq('id', id)
    .maybeSingle()

  if (lp) {
    const slug = Array.isArray(lp.landing_pages) ? (lp.landing_pages[0] as any)?.slug : (lp.landing_pages as any)?.slug
    if (lp.payment_status === 'paid')
      return NextResponse.redirect(`${appUrl}/lp/${slug}/berjaya?pesanan=${lp.order_number}`, 302)

    const itemsArr: any[] = Array.isArray(lp.items) && lp.items.length > 0
      ? lp.items
      : [{ product_name: lp.product_name, variant_name: lp.variant_name, quantity: lp.quantity, unit_price: lp.unit_price }]

    // Ada diskaun → satu baris = total (elak baris negatif di Chip). Tiada → itemize.
    const hasDiscount = Number(lp.discount ?? 0) > 0 || Number(lp.points_discount ?? 0) > 0
    const products: ChipProduct[] = hasDiscount
      ? [{ name: `Pesanan ${lp.order_number}`, price: Math.round(Number(lp.total) * 100), quantity: 1 }]
      : itemsArr.map((i) => ({
          name: `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`,
          price: Math.round(Number(i.unit_price) * 100), quantity: i.quantity,
        }))
    const deliveryFee = Number(lp.delivery_fee ?? 0)
    if (!hasDiscount && deliveryFee > 0) products.push({ name: 'Kos Penghantaran', price: Math.round(deliveryFee * 100), quantity: 1 })

    const out = await createCheckout({
      client: { email: `lp+${lp.order_number}@syababfresh.my`, full_name: lp.name, phone: lp.phone },
      products, reference: lp.id, notes: lp.order_number,
      successUrl: `${appUrl}/lp/${slug}/berjaya?pesanan=${lp.order_number}`,
      failureUrl: `${appUrl}/lp/${slug}?bayar=gagal`,
      cancelUrl: `${appUrl}/lp/${slug}`,
      appUrl,
    })
    if (!out) return fail
    await supabase.from('lp_guest_orders').update({ payment_ref: out.id }).eq('id', lp.id)
    return NextResponse.redirect(out.url, 302)
  }

  return fail
}
