import { requireAdmin } from '@/lib/supabase/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardLpLoyalty } from '@/lib/lp-loyalty'
import { reverseLpLoyalty } from '@/lib/loyalty-reverse'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const url = new URL(request.url)
  const pageId = url.searchParams.get('page_id')
  const status = url.searchParams.get('status')

  let query = supabase!
    .from('lp_guest_orders')
    .select('id, order_number, name, phone, address, postcode, product_name, variant_name, quantity, unit_price, delivery_fee, total, payment_method, payment_status, status, notes, source, created_at, landing_pages(title, slug)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (pageId) query = query.eq('page_id', pageId)
  if (status) query = query.eq('status', status)
  else query = query.not('status', 'in', '(delivered,cancelled,refunded)')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Hide unpaid online (FPX/e-wallet) orders — customer opened the payment page but
  // never completed payment. COD/bank orders always show.
  const visible = (data ?? []).filter((o: any) =>
    ['fpx', 'ewallet'].includes(o.payment_method) ? o.payment_status === 'paid' : true
  )
  return NextResponse.json(visible)
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const { id, status, payment_status, name, phone, address, postcode, notes, courier_id, tracking_number, tracking_url, shipment_notes, delivery_fee } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Status update
  if (status !== undefined) {
    const VALID = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled', 'refunded']
    if (!VALID.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    update.status = status
    // Cap masa transisi penghantaran (dipakai cron auto-deliver)
    if (status === 'delivering') update.delivering_at = update.updated_at
    if (status === 'delivered')  update.delivered_at  = update.updated_at
  }

  // Payment status update (manual confirm COD/bank, atau tanda belum bayar)
  if (payment_status !== undefined) {
    const VALID_PAY = ['unpaid', 'paid', 'refunded', 'failed']
    if (!VALID_PAY.includes(payment_status)) return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
    update.payment_status = payment_status
  }

  // Customer details update
  if (name !== undefined) update.name = String(name).trim()
  if (phone !== undefined) update.phone = String(phone).trim()
  if (address !== undefined) update.address = String(address).trim()
  if (postcode !== undefined) update.postcode = postcode ? String(postcode).trim() : null
  if (notes !== undefined) update.notes = notes ? String(notes).trim() : null
  if (courier_id !== undefined) update.courier_id = courier_id || null
  if (tracking_number !== undefined) update.tracking_number = tracking_number || null
  if (tracking_url !== undefined) update.tracking_url = tracking_url || null
  if (shipment_notes !== undefined) update.shipment_notes = shipment_notes || null

  // Kos penghantaran — reseller (B2B) sahaja, dirunding. Kira semula total dari item.
  if (delivery_fee !== undefined) {
    const fee = Number(delivery_fee)
    if (!Number.isFinite(fee) || fee < 0) return NextResponse.json({ error: 'Kos penghantaran tidak sah' }, { status: 400 })
    const { data: ord } = await supabase!
      .from('lp_guest_orders')
      .select('source, items, discount, points_discount')
      .eq('id', id)
      .single()
    if (!ord) return NextResponse.json({ error: 'Order tidak dijumpai' }, { status: 404 })
    if (ord.source !== 'reseller') return NextResponse.json({ error: 'Kos penghantaran hanya boleh diubah untuk order reseller' }, { status: 400 })
    const items: any[] = Array.isArray(ord.items) ? ord.items : []
    const subtotal = items.reduce((s, i) => s + Number(i.unit_price || 0) * Number(i.quantity || 0), 0)
    update.delivery_fee = fee
    update.total = Math.max(0, subtotal + fee - Number(ord.discount || 0) - Number(ord.points_discount || 0))
  }

  const { error } = await supabase!
    .from('lp_guest_orders')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Loyalty side-effects on terminal status changes (use service role for the RPCs)
  if (status === 'delivered' || status === 'refunded' || status === 'cancelled') {
    const admin = createAdminClient()
    const { data: lp } = await admin
      .from('lp_guest_orders')
      .select('id, order_number, phone, total, payment_method, payment_status, user_id, source')
      .eq('id', id)
      .single()
    if (lp) {
      // Delivered (payment received, incl. COD/bank) → award (user_id, atau match telefon).
      // Refunded/cancelled → reverse earned + redeemed (mata ditebus dipulang). Semua idempotent.
      if (status === 'delivered') await awardLpLoyalty(admin, lp).catch(() => {})
      else await reverseLpLoyalty(admin, lp).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
