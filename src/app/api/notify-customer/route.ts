import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'

const statusMessage: Record<string, string> = {
  confirmed:  '✅ Pesanan anda telah *disahkan*! Kami sedang menyediakan buah-buahan segar untuk anda.',
  preparing:  '🧺 Pesanan anda sedang *disediakan*. Buah-buahan segar sedang dipilih dengan teliti!',
  delivering: '🚚 Pesanan anda sedang *dalam penghantaran*! Penghantar kami sedang dalam perjalanan.',
  delivered:  '🎉 Pesanan anda telah *selesai dihantar*! Terima kasih kerana memilih SyababFresh. Selamat menikmati! 🍎🍊',
  cancelled:  '❌ Pesanan anda telah *dibatalkan*. Hubungi kami jika ada pertanyaan.',
}

export async function POST(request: Request) {
  const { orderId, status } = await request.json()

  if (!orderId || !status) {
    return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })
  }

  const msg = statusMessage[status]
  if (!msg) return NextResponse.json({ skipped: true })

  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('order_number, profiles(full_name, phone)')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const phone = (order.profiles as any)?.phone
  if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' })

  const message = [
    `Hai *${(order.profiles as any)?.full_name ?? 'Pelanggan'}*! 👋`,
    ``,
    msg,
    ``,
    `📦 No. Pesanan: *${order.order_number}*`,
    ``,
    `_SyababFresh — Buah Segar Setiap Hari_ 🌿`,
  ].join('\n')

  const result = await sendWhatsApp(phone, message)
  return NextResponse.json(result)
}
