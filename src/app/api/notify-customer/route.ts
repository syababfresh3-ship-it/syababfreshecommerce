import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'

const statusMessage: Record<string, string> = {
  confirmed:  '✅ Pesanan anda telah *disahkan*! Kami sedang menyediakan buah-buahan segar untuk anda.',
  preparing:  '🧺 Pesanan anda sedang *disediakan*. Buah-buahan segar sedang dipilih dengan teliti!',
  delivering: '🚚 Pesanan anda sedang *dalam penghantaran*! Penghantar kami sedang dalam perjalanan.',
  delivered:  '🎉 Pesanan anda telah *selesai dihantar*! Terima kasih kerana memilih SyababFresh. Selamat menikmati! 🍎🍊',
  cancelled:  '❌ Pesanan anda telah *dibatalkan*. Hubungi kami jika ada pertanyaan.',
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { orderId, status, trackingUrl } = await request.json()

  if (!orderId || !status) {
    return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })
  }

  const msg = statusMessage[status]
  if (!msg) return NextResponse.json({ skipped: true })

  const { data: order } = await supabase!
    .from('orders')
    .select('order_number, profiles(full_name, phone, email)')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const phone = (order.profiles as any)?.phone
  if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' })

  const lines = [
    `Hai *${(order.profiles as any)?.full_name ?? 'Pelanggan'}*! 👋`,
    ``,
    msg,
    ``,
    `📦 No. Pesanan: *${order.order_number}*`,
  ]

  if (status === 'delivering' && trackingUrl) {
    lines.push(``)
    lines.push(`🔗 *Link Penghantaran:*`)
    lines.push(trackingUrl)
  }

  lines.push(``)
  lines.push(`_SyababFresh — Buah Segar Setiap Hari_ 🌿`)

  const message = lines.join('\n')

  if (phone) sendWhatsApp(phone, message).catch(() => {})

  // Send delivery status email (preparing / delivering / delivered)
  const customerEmail = (order.profiles as any)?.email
  if (customerEmail && ['preparing', 'delivering', 'delivered'].includes(status)) {
    sendDeliveryStatusEmail({
      to: customerEmail,
      customerName: (order.profiles as any)?.full_name ?? 'Pelanggan',
      orderNumber: order.order_number,
      status,
      orderId,
    }).catch(err => console.error('[notify-customer] email error:', err))
  }

  return NextResponse.json({ ok: true })
}
