import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// PATCH /api/admin/orders/[id]/customer — kemas kini butiran PENGHANTARAN order
// storefront (SYB-) secara inline dari page admin, selari dengan edit LP
// (lp-customer-edit → PATCH /api/admin/landing-pages/orders).
//
// Hanya lajur yang WUJUD pada `orders` disentuh: delivery_address, postcode.
// Nama/telefon/email pelanggan storefront duduk di `profiles` (identiti akaun —
// dipakai loyalty, CRM phone_norm, WA) jadi SENGAJA tidak diubah di sini.
//
// Diasingkan dari PATCH /api/admin/orders/[id] (status/bayaran/approve) supaya
// flow sedia ada tidak berubah langsung.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ADDRESS_LEN = 1000

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID tidak sah' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Badan permintaan tidak sah' }, { status: 400 })
  }

  const { data: order } = await supabase!
    .from('orders')
    .select('id, delivery_method')
    .eq('id', id)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Order tidak dijumpai' }, { status: 404 })

  // Pickup (ambil sendiri) tiada alamat/poskod wajib — benarkan kosong.
  const isPickup = order.delivery_method === 'pickup'
  const update: Record<string, unknown> = {}

  if (body.delivery_address !== undefined) {
    if (body.delivery_address !== null && typeof body.delivery_address !== 'string')
      return NextResponse.json({ error: 'Alamat tidak sah' }, { status: 400 })
    const addr = (body.delivery_address ?? '').toString().trim()
    if (!isPickup && !addr) return NextResponse.json({ error: 'Alamat diperlukan' }, { status: 400 })
    if (addr.length > MAX_ADDRESS_LEN) return NextResponse.json({ error: 'Alamat terlalu panjang' }, { status: 400 })
    update.delivery_address = addr || null
  }

  if (body.postcode !== undefined) {
    if (body.postcode !== null && typeof body.postcode !== 'string' && typeof body.postcode !== 'number')
      return NextResponse.json({ error: 'Poskod tidak sah' }, { status: 400 })
    const pc = (body.postcode ?? '').toString().trim()
    if (pc && !/^\d{5}$/.test(pc)) return NextResponse.json({ error: 'Poskod mesti 5 digit' }, { status: 400 })
    if (!isPickup && !pc) return NextResponse.json({ error: 'Poskod diperlukan (5 digit)' }, { status: 400 })
    update.postcode = pc || null
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'Tiada medan untuk dikemas kini' }, { status: 400 })

  update.updated_at = new Date().toISOString()

  const { error } = await supabase!.from('orders').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
