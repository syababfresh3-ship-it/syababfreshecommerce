import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { handleOrderDelivered } from '@/lib/order-delivered'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { sendTrackingEmail } from '@/lib/zeptomail'

export async function GET(request: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const carrier = searchParams.get('carrier')
  const status = searchParams.get('status')

  let query = supabase
    .from('order_shipments')
    .select('*, shipping_carriers(id, name), orders(id, order_number, user_id)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (carrier) query = query.eq('carrier_id', carrier)
  if (status) query = query.eq('status', status)

  const { data: shipments, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((shipments ?? []).map((s: any) => s.orders?.user_id).filter(Boolean))]
  const profileMap: Record<string, { full_name: string; phone: string }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', userIds)
    for (const p of profiles ?? []) profileMap[p.id] = p
  }

  const enriched = (shipments ?? []).map((s: any) => ({
    ...s,
    profile: s.orders?.user_id ? profileMap[s.orders.user_id] ?? null : null,
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { order_id, carrier_id, tracking_number, direct_url, estimated_delivery, notes, status } = body

  if (!order_id || !carrier_id) {
    return NextResponse.json({ error: 'order_id dan carrier_id diperlukan' }, { status: 400 })
  }

  // Determine tracking URL: direct_url (Lalamove) takes priority, else auto-generate from template
  let tracking_url: string | null = direct_url ?? null
  if (!tracking_url && tracking_number) {
    const { data: carrier } = await supabase
      .from('shipping_carriers')
      .select('tracking_url_template')
      .eq('id', carrier_id)
      .single()
    if (carrier?.tracking_url_template) {
      tracking_url = carrier.tracking_url_template.replace('{number}', tracking_number)
    }
  }

  // Upsert PRIMARY shipment (refund_id is null) — replacement shipments (refund-linked)
  // are managed separately via the refunds module and must not be touched here.
  const row = {
    order_id,
    carrier_id,
    tracking_number: tracking_number ?? null,
    tracking_url,
    estimated_delivery: estimated_delivery ?? null,
    notes: notes ?? null,
    status: status ?? 'pending',
    updated_at: new Date().toISOString(),
  }
  const { data: existing } = await supabase
    .from('order_shipments')
    .select('id')
    .eq('order_id', order_id)
    .is('refund_id', null)
    .maybeSingle()
  const { data: shipment, error } = existing
    ? await supabase.from('order_shipments').update(row).eq('id', existing.id).select().single()
    : await supabase.from('order_shipments').insert(row).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-update order status when shipment is active
  const now = new Date().toISOString()
  if (status && ['picked_up', 'in_transit', 'out_for_delivery'].includes(status)) {
    await supabase
      .from('orders')
      .update({ status: 'delivering', delivering_at: now })
      .eq('id', order_id)
      .in('status', ['pending', 'confirmed', 'preparing'])
  } else if (status === 'delivered') {
    const { data: synced } = await supabase
      .from('orders')
      .update({ status: 'delivered', delivered_at: now })
      .eq('id', order_id)
      .neq('status', 'cancelled')
      .select('id')
    // Loyalty + referral + affiliate, only if the order actually transitioned
    if (synced && synced.length) await handleOrderDelivered(supabase, order_id)
  }

  // Notify customer via WhatsApp + Email if tracking info available
  if (tracking_url || tracking_number) {
    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, user_id')
      .eq('id', order_id)
      .single()

    const { data: carrier } = await supabase
      .from('shipping_carriers')
      .select('name')
      .eq('id', carrier_id)
      .single()

    const { data: customerProfile } = order?.user_id ? await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', order.user_id)
      .single() : { data: null }

    const phone = customerProfile?.phone
    const email = customerProfile?.email
    const name  = customerProfile?.full_name ?? 'Pelanggan'
    const carrierName = carrier?.name ?? carrier_id

    if (order) {
      // WhatsApp (jika ada phone)
      if (phone) {
        const trackingLine = tracking_url
          ? `🔗 *Link Penghantaran:*\n${tracking_url}`
          : `📦 *No. Tracking:* ${tracking_number}`

        const msg = [
          `🚚 *Pesanan ${order.order_number} Dalam Penghantaran!*`,
          ``,
          `Hai ${name}, pesanan anda sedang dalam perjalanan.`,
          ``,
          trackingLine,
          ``,
          `_SyababFresh — Buah Segar Setiap Hari_ 🌿`,
        ].join('\n')

        sendWhatsApp(phone, msg).catch(() => {})
      }

      // Email (sentiasa hantar jika ada email)
      if (email) {
        sendTrackingEmail({
          to: email,
          customerName: name,
          orderNumber: order.order_number,
          orderId: order.id,
          carrierName,
          trackingNumber: tracking_number ?? null,
          trackingUrl: tracking_url ?? null,
          estimatedDelivery: estimated_delivery ?? null,
        }).catch(err => console.error('[shipment] email error:', err))
      }
    }
  }

  return NextResponse.json(shipment)
}
