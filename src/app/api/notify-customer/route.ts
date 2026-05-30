import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'
import { getWaTemplates, buildStatusMessage } from '@/lib/wa-templates'

export async function POST(request: Request) {
  console.log('[notify-customer] POST received')
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { orderId, status, trackingUrl } = await request.json()
  if (!orderId || !status) return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })

  const { data: order } = await supabase!
    .from('orders')
    .select('order_number, user_id')
    .eq('id', orderId)
    .single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: profile } = await supabase!
    .from('profiles')
    .select('full_name, phone, email')
    .eq('id', order.user_id)
    .single()

  const phone = profile?.phone
  if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' })

  const templates = await getWaTemplates()
  const message = buildStatusMessage(templates, status, {
    name: profile?.full_name ?? 'Pelanggan',
    order_number: order.order_number,
    tracking_url: trackingUrl,
  })
  if (!message) return NextResponse.json({ skipped: true, reason: 'no template for status' })

  sendWhatsApp(phone, message).catch(err => console.error('[notify-customer] error:', err))

  // Email notification
  const customerEmail = profile?.email
  if (customerEmail && ['preparing', 'delivering', 'delivered'].includes(status)) {
    sendDeliveryStatusEmail({
      to: customerEmail,
      customerName: profile?.full_name ?? 'Pelanggan',
      orderNumber: order.order_number,
      status,
      orderId,
    }).catch(err => console.error('[notify-customer] email error:', err))
  }

  return NextResponse.json({ ok: true })
}
