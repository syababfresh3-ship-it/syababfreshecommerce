import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'
import { getWaTemplates, buildStatusMessage } from '@/lib/wa-templates'

export async function POST(request: Request) {
  console.log('[notify-customer] POST received')
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { orderId, status, trackingUrl, deliveryMethod } = await request.json()
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
    .select('full_name, phone, email')
    .eq('id', order.user_id)
    .single()

  const phone = profile?.phone
  if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' })

  const name = profile?.full_name ?? 'Pelanggan'

  // Pickup: status 'delivering' = sedia diambil (bukan dalam penghantaran)
  let message: string | null
  if (isPickup && status === 'delivering') {
    message = [
      `Hai ${name} 🌿`,
      ``,
      `Pesanan *${order.order_number}* anda sudah sedia untuk diambil! 🎉`,
      ``,
      `📍 *Lokasi:* SyababFresh, Kompleks Premis Usahawan SME Bank Bangi, Seksyen 16, Bandar New Bangi`,
      `🕐 *Waktu:* Isnin–Sabtu, 9 pagi – 6 petang`,
      ``,
      `Jumpa di kedai! _SyababFresh 🌿_`,
    ].join('\n')
  } else {
    const templates = await getWaTemplates()
    message = buildStatusMessage(templates, status, {
      name,
      order_number: order.order_number,
      tracking_url: trackingUrl,
    })
  }
  if (!message) return NextResponse.json({ skipped: true, reason: 'no template for status' })

  sendWhatsApp(phone, message).catch(err => console.error('[notify-customer] error:', err))

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
