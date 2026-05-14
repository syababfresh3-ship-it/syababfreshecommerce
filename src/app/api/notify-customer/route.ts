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
  console.log('[notify-customer] POST received')
  const { supabase, forbidden } = await requireAdmin()
  console.log('[notify-customer] auth:', forbidden ? 'FAILED' : 'OK')
  if (forbidden) return forbidden

  const { orderId, status, trackingUrl } = await request.json()
  console.log('[notify-customer] body:', { orderId, status, trackingUrl })

  if (!orderId || !status) {
    return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })
  }

  const msg = statusMessage[status]
  if (!msg) return NextResponse.json({ skipped: true })

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
  console.log('[notify-customer] orderId:', orderId, 'status:', status, 'phone:', phone ? 'ada' : 'TIADA')
  if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' })

  const lines = [
    `Hai *${profile?.full_name ?? 'Pelanggan'}*! 👋`,
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

  if (phone) sendWhatsApp(phone, message).then(r => console.log('[notify-customer] murpati:', JSON.stringify(r))).catch(err => console.error('[notify-customer] murpati error:', err))

  // Send delivery status email (preparing / delivering / delivered)
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
