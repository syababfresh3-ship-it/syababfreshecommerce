import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'

export async function POST(request: Request) {
  const { orderId } = await request.json()

  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  const adminPhone = process.env.ADMIN_WHATSAPP
  if (!adminPhone) return NextResponse.json({ skipped: true })

  // Fetch order details
  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('order_number, total, delivery_address, payment_method, notes, profiles(full_name, phone), order_items(product_name, quantity, unit_price)')
    .eq('id', orderId)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const paymentLabel: Record<string, string> = {
    fpx: 'FPX',
    ewallet: 'E-Wallet',
    cod: 'COD',
    bank_transfer: 'Pindahan Bank',
  }

  const itemLines = (order.order_items as any[])
    .map((i) => `• ${i.product_name} x${i.quantity} — RM${(i.unit_price * i.quantity).toFixed(2)}`)
    .join('\n')

  const message = [
    `🛒 *Pesanan Baru — ${order.order_number}*`,
    ``,
    `👤 *Pelanggan:* ${(order.profiles as any)?.full_name ?? '—'}`,
    `📱 *Telefon:* ${(order.profiles as any)?.phone ?? '—'}`,
    ``,
    `🧺 *Item:*`,
    itemLines,
    ``,
    `💰 *Jumlah:* RM${Number(order.total).toFixed(2)}`,
    `💳 *Bayaran:* ${paymentLabel[order.payment_method as string] ?? order.payment_method}`,
    ``,
    `📍 *Alamat:*`,
    order.delivery_address ?? '—',
    order.notes ? `\n📝 *Nota:* ${order.notes}` : '',
  ].filter((l) => l !== undefined).join('\n')

  const result = await sendWhatsApp(adminPhone, message)
  return NextResponse.json(result)
}
