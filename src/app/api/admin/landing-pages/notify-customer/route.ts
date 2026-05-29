import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'

const statusMessage: Record<string, string> = {
  confirmed:  '✅ Your order has been *confirmed*! We are preparing your fresh fruits.',
  preparing:  '🧺 Your order is being *prepared*. Fresh fruits are being carefully selected!',
  delivering: '🚚 Your order is *out for delivery*! Our courier is on the way.',
  delivered:  '🎉 Your order has been *delivered*! Thank you for choosing SyababFresh. Enjoy! 🍎🍊',
  cancelled:  '❌ Your order has been *cancelled*. Contact us if you have any questions.',
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { orderId, status, trackingUrl } = await request.json()
  if (!orderId || !status) return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })

  const msg = statusMessage[status]
  if (!msg) return NextResponse.json({ skipped: true })

  const { data: order } = await supabase!
    .from('lp_guest_orders')
    .select('order_number, name, phone')
    .eq('id', orderId)
    .single()

  if (!order?.phone) return NextResponse.json({ skipped: true, reason: 'no phone' })

  const lines = [
    `Hi *${order.name}*! 👋`,
    ``,
    msg,
    ``,
    `📦 Order No: *${order.order_number}*`,
  ]

  if (status === 'delivering' && trackingUrl) {
    lines.push(``)
    lines.push(`🔗 *Tracking / Delivery Link:*`)
    lines.push(trackingUrl)
  }

  lines.push(``)
  lines.push(`_SyababFresh — Fresh Fruits Every Day_ 🌿`)

  sendWhatsApp(order.phone, lines.join('\n')).catch(() => {})

  return NextResponse.json({ ok: true })
}
