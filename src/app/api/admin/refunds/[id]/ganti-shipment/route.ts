import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// Cipta / kemaskini shipment GANTI sebenar dalam modul shipping untuk refund
// jenis ganti_produk. Replacement = order_shipments row (refund-linked) berasingan
// dari shipment asal order. Auto-jana tracking URL dari template carrier.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await req.json()
  const { carrier_id, tracking_number, estimated_delivery } = body
  if (!carrier_id) return NextResponse.json({ error: 'Sila pilih kurier.' }, { status: 400 })

  const { data: refund } = await supabase!
    .from('refunds')
    .select('id, order_id, payment_method')
    .eq('id', id)
    .single()
  if (!refund) return NextResponse.json({ error: 'Refund tidak dijumpai.' }, { status: 404 })
  if (refund.payment_method !== 'ganti_produk') {
    return NextResponse.json({ error: 'Refund ini bukan jenis ganti produk.' }, { status: 400 })
  }

  // Auto-jana tracking URL dari template carrier (kalau ada no tracking)
  let tracking_url: string | null = null
  const { data: carrier } = await supabase!
    .from('shipping_carriers')
    .select('name, tracking_url_template')
    .eq('id', carrier_id)
    .single()
  if (tracking_number && carrier?.tracking_url_template) {
    tracking_url = carrier.tracking_url_template.replace('{number}', String(tracking_number).trim())
  }

  const row = {
    order_id: refund.order_id,
    refund_id: refund.id,
    carrier_id,
    tracking_number: tracking_number ? String(tracking_number).trim() : null,
    tracking_url,
    estimated_delivery: estimated_delivery || null,
    status: tracking_number ? 'in_transit' : 'pending',
    shipped_at: tracking_number ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  // Upsert ikut refund_id (satu replacement shipment per refund)
  const { data: existing } = await supabase!
    .from('order_shipments')
    .select('id')
    .eq('refund_id', refund.id)
    .maybeSingle()
  const { data: shipment, error } = existing
    ? await supabase!.from('order_shipments').update(row).eq('id', existing.id).select('*, shipping_carriers(id, name)').single()
    : await supabase!.from('order_shipments').insert(row).select('*, shipping_carriers(id, name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Tulis balik ke refund supaya detail + WA tracking ada maklumat terkini
  await supabase!.from('refunds').update({
    ganti_courier: carrier?.name ?? carrier_id,
    ganti_tracking_no: row.tracking_number,
    ganti_tracking_link: tracking_url,
  }).eq('id', refund.id)

  return NextResponse.json(shipment)
}
