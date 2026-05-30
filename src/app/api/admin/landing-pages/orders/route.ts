import { requireAdmin } from '@/lib/supabase/require-admin'
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
  else query = query.not('status', 'in', '(delivered,cancelled)')

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
  const { id, status, name, phone, address, postcode, notes, courier_id, tracking_number, tracking_url, shipment_notes } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Status update
  if (status !== undefined) {
    const VALID = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled']
    if (!VALID.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    update.status = status
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

  const { error } = await supabase!
    .from('lp_guest_orders')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
