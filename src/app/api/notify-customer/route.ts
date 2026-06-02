import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'

// Nota: notifikasi status ke customer kini guna EMAIL sahaja. WhatsApp ke customer
// dibuang (kurangkan risiko ban WA tidak rasmi) — WA kekal hanya untuk tracking.
export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { orderId, status, deliveryMethod } = await request.json()
  if (!orderId || !status) return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })

  const { data: order } = await supabase!
    .from('orders')
    .select('order_number, user_id, delivery_method')
    .eq('id', orderId)
    .single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const isPickup = (deliveryMethod ?? order.delivery_method) === 'pickup'

  const { data: profile } = await supabase!
    .from('profiles')
    .select('full_name, email')
    .eq('id', order.user_id)
    .single()

  // Email notification — langkau email "dalam penghantaran" untuk pickup
  const customerEmail = profile?.email
  if (customerEmail && !(isPickup && status === 'delivering') && ['preparing', 'delivering', 'delivered'].includes(status)) {
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
