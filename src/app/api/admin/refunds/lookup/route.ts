import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// Cari order untuk borang refund — terima order_number ATAU order id (uuid).
export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ error: 'Masukkan no order.' }, { status: 400 })

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)
  const { data: order } = await supabase!
    .from('orders')
    .select('id, order_number, total, status, payment_status, user_id, delivery_address, order_items(id, product_name, quantity, unit_price)')
    .eq(isUuid ? 'id' : 'order_number', q)
    .maybeSingle()

  // Storefront order dijumpai → pulangkan terus.
  if (order) {
    const { data: profile } = order.user_id
      ? await supabase!.from('profiles').select('full_name, phone').eq('id', order.user_id).single()
      : { data: null }

    const { data: existing } = await supabase!
      .from('refunds')
      .select('id, status, jumlah_refund, created_at')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      order: {
        id: order.id,
        source: 'orders',
        order_number: order.order_number,
        total: order.total,
        status: order.status,
        payment_status: order.payment_status,
        delivery_address: order.delivery_address,
        customer_name: (profile as { full_name?: string } | null)?.full_name ?? null,
        customer_phone: (profile as { phone?: string } | null)?.phone ?? null,
        items: order.order_items ?? [],
      },
      existingRefunds: existing ?? [],
    })
  }

  // Fallback: LP / reseller guest order (lp_guest_orders).
  const { data: lp } = await supabase!
    .from('lp_guest_orders')
    .select('id, order_number, total, status, payment_status, name, phone, address, items, product_name, variant_name, quantity, unit_price')
    .eq(isUuid ? 'id' : 'order_number', q)
    .maybeSingle()

  if (!lp) return NextResponse.json({ error: 'Order tidak dijumpai.' }, { status: 404 })

  // LP order boleh multi-item (jsonb `items`) atau single (kolum produk).
  const lpItems = Array.isArray(lp.items) && lp.items.length > 0
    ? lp.items.map((it: { product_name: string; quantity: number; unit_price: number }) => ({
        id: null, product_name: it.product_name, quantity: it.quantity, unit_price: it.unit_price,
      }))
    : [{ id: null, product_name: lp.product_name, quantity: lp.quantity, unit_price: lp.unit_price }]

  const { data: lpExisting } = await supabase!
    .from('refunds')
    .select('id, status, jumlah_refund, created_at')
    .eq('lp_order_id', lp.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    order: {
      id: lp.id,
      source: 'lp',
      order_number: lp.order_number,
      total: lp.total,
      status: lp.status,
      payment_status: lp.payment_status,
      delivery_address: lp.address ?? null,
      customer_name: lp.name ?? null,
      customer_phone: lp.phone ?? null,
      items: lpItems,
    },
    existingRefunds: lpExisting ?? [],
  })
}
