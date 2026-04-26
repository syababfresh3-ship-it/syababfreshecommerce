import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const now = new Date().toISOString()

  // Fetch existing shipment to get carrier template and order_id
  const { data: existing } = await supabase
    .from('order_shipments')
    .select('order_id, carrier_id, tracking_number, shipping_carriers(tracking_url_template)')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const update: Record<string, unknown> = { updated_at: now }

  if (body.tracking_number !== undefined) update.tracking_number = body.tracking_number
  if (body.status) update.status = body.status
  if (body.notes !== undefined) update.notes = body.notes
  if (body.estimated_delivery !== undefined) update.estimated_delivery = body.estimated_delivery

  // Auto-generate tracking URL from carrier template
  const trackingNum = body.tracking_number ?? existing.tracking_number
  const template = (existing.shipping_carriers as any)?.tracking_url_template
  if (trackingNum && template) {
    update.tracking_url = template.replace('{number}', trackingNum)
  }

  // Timestamps for status transitions
  if (body.status && ['picked_up', 'in_transit', 'out_for_delivery'].includes(body.status)) {
    update.shipped_at = now
  }
  if (body.status === 'delivered') {
    update.delivered_at = now
  }

  // Sync order status
  if (body.status === 'delivered') {
    await supabase
      .from('orders')
      .update({ status: 'delivered', delivered_at: now })
      .eq('id', existing.order_id)
      .neq('status', 'cancelled')
  } else if (body.status && ['picked_up', 'in_transit', 'out_for_delivery'].includes(body.status)) {
    await supabase
      .from('orders')
      .update({ status: 'delivering', delivering_at: now })
      .eq('id', existing.order_id)
      .in('status', ['pending', 'confirmed', 'preparing'])
  }

  const { error } = await supabase.from('order_shipments').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
