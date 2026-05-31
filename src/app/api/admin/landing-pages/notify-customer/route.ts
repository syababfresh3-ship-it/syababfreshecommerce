import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { getWaTemplates, buildStatusMessage } from '@/lib/wa-templates'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { orderId, status, trackingUrl } = await request.json()
  if (!orderId || !status) return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })

  const { data: order } = await supabase!
    .from('lp_guest_orders')
    .select('order_number, name, phone, delivery_method, email')
    .eq('id', orderId)
    .single()

  if (!order?.phone) return NextResponse.json({ skipped: true, reason: 'no phone' })

  const isPickup = order.delivery_method === 'pickup'

  // Pickup: status 'delivering' = sedia diambil (bukan dalam penghantaran)
  let message: string | null
  if (isPickup && status === 'delivering') {
    message = [
      `Hai ${order.name} 🌿`,
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
      name: order.name,
      order_number: order.order_number,
      tracking_url: trackingUrl,
    })
  }
  if (!message) return NextResponse.json({ skipped: true, reason: 'no template for status' })

  sendWhatsApp(order.phone, message).catch(() => {})

  // Email selari WA untuk status penghantaran (kalau customer isi email) — bukan pickup
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
