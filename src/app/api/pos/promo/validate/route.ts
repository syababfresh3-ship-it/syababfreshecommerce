import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { evaluatePromo, type PromoItem, type PromoRow } from '@/lib/promo-rules'
import { countGuestPromoUses } from '@/lib/promo-usage'
import { normalizePhone } from '@/lib/phone'

// Sahkan kod promo untuk tiket POS — peraturan sama dengan kedai (lib/promo-rules.ts).
// free_shipping ditolak (tiada penghantaran di kaunter). Kiraan guna sebelum ini = order LP/tetamu
// (countGuestPromoUses) + jualan POS dengan telefon sama.
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const sb = auth.supabase!

  const body = await request.json().catch(() => ({}))
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const subtotal = Number(body.subtotal)
  if (!code || !Number.isFinite(subtotal) || subtotal < 0) return NextResponse.json({ ok: false, error: 'Promo code and subtotal required' }, { status: 400 })
  const items: PromoItem[] = Array.isArray(body.items)
    ? body.items.filter((i: unknown) => i && typeof (i as PromoItem).product_id === 'string')
        .map((i: PromoItem) => ({ product_id: i.product_id, category_id: i.category_id ?? null, line_total: Number(i.line_total) || 0 }))
    : []

  const { data: promo, error } = await sb.from('promo_codes').select('*').ilike('code', code).maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!promo) return NextResponse.json({ ok: false, error: 'Promo code not found' })
  if ((promo as PromoRow).type === 'free_shipping') return NextResponse.json({ ok: false, error: 'Free-shipping codes do not apply at the counter' })

  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : null)
  let priorUses = 0
  if (phone) {
    priorUses = await countGuestPromoUses(sb, promo.id, phone)
    const { count } = await sb.from('pos_sales').select('id', { count: 'exact', head: true }).eq('promo_code_id', promo.id).eq('customer_phone', phone).neq('status', 'void')
    priorUses += count ?? 0
  }

  const result = evaluatePromo(promo as PromoRow, { subtotal, deliveryFee: 0, items, priorUses })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error })
  return NextResponse.json({ ok: true, promo: { id: promo.id, code: promo.code, discount: result.discount, type: promo.type, value: promo.value } })
}
