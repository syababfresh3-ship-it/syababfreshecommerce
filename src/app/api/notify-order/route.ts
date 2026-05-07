import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { sendOrderConfirmationEmail } from '@/lib/zeptomail'

export async function POST(request: Request) {
  const { orderId } = await request.json()

  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  // Verify caller is authenticated and owns this order
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ownership } = await supabase
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()
  if (!ownership) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: order } = await supabase
    .from('orders')
    .select('order_number, total, delivery_address, delivery_slot, payment_method, notes, profiles(full_name, phone, email), order_items(product_name, quantity, unit_price, variant_name)')
    .eq('id', orderId)
    .single()

  const adminPhone = process.env.ADMIN_WHATSAPP

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

  if (adminPhone) sendWhatsApp(adminPhone, message).catch(() => {})

  // Send order confirmation email to customer
  const profile = order.profiles as any
  const customerEmail = profile?.email
  if (customerEmail) {
    sendOrderConfirmationEmail({
      to: customerEmail,
      customerName: profile?.full_name ?? 'Pelanggan',
      orderNumber: order.order_number,
      items: (order.order_items as any[]).map(i => ({
        name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        variant_name: i.variant_name ?? null,
      })),
      total: Number(order.total),
      deliveryAddress: order.delivery_address ?? null,
      deliverySlot: (order as any).delivery_slot ?? null,
      paymentMethod: order.payment_method,
      notes: order.notes ?? null,
    }).catch(err => console.error('[notify-order] email error:', err))
  }

  return NextResponse.json({ ok: true })
}
