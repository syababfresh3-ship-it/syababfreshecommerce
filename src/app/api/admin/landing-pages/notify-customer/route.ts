import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'

// Nota: notifikasi status ke customer LP kini guna EMAIL sahaja. WhatsApp ke
// customer dibuang (kurangkan risiko ban WA tidak rasmi) — WA kekal hanya tracking.
export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { orderId, status } = await request.json()
  if (!orderId || !status) return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })

  const { data: order } = await supabase!
    .from('lp_guest_orders')
    .select('order_number, name, delivery_method, email')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const isPickup = order.delivery_method === 'pickup'

  // Email status penghantaran (kalau customer isi email) — bukan pickup
  if (order.email && !isPickup && ['preparing', 'delivering', 'delivered'].includes(status)) {
    sendDeliveryStatusEmail({
      to: order.email,
      customerName: order.name,
      orderNumber: order.order_number,
      status,
      // orderId sengaja ditinggal — LP guest tiada halaman /orders, butang disorok
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
