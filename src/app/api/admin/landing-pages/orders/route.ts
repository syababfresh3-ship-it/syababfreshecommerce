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
    .select('id, order_number, name, phone, address, postcode, product_name, variant_name, quantity, unit_price, delivery_fee, total, payment_method, status, notes, source, created_at, landing_pages(title, slug)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (pageId) query = query.eq('page_id', pageId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const { id, status } = body

  const VALID = ['pending', 'confirmed', 'cancelled']
  if (!id || !status || !VALID.includes(status))
    return NextResponse.json({ error: 'Tidak sah' }, { status: 400 })

  const { error } = await supabase!
    .from('lp_guest_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
