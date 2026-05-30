import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'
import { sendAdminPush } from '@/lib/push'

export const runtime = 'nodejs'

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

// Browser-triggered fallback for LP guest FPX orders — confirms payment directly
// with CHIP when the server-to-server webhook hasn't (or can't) reach us.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('lp_guest_orders')
    .select('id, order_number, name, phone, total, items, payment_method, status, payment_ref, landing_pages(title)')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order tidak dijumpai' }, { status: 404 })

  // Already processed
  if (order.status !== 'pending') return NextResponse.json({ status: order.status })

  // Only FPX/e-wallet pay online via CHIP
  if (!['fpx', 'ewallet'].includes(order.payment_method)) {
    return NextResponse.json({ status: order.status })
  }

  const purchaseId = order.payment_ref
  if (!purchaseId || !process.env.CHIP_SECRET_KEY) {
    return NextResponse.json({ status: 'pending', reason: 'no_ref' })
  }

  const chipRes = await fetch(`${CHIP_API_URL}/purchases/${purchaseId}/`, {
    headers: { Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}` },
  })
  if (!chipRes.ok) return NextResponse.json({ status: 'pending', reason: 'chip_error' })

  const purchase = await chipRes.json()
  if (purchase.status !== 'paid') return NextResponse.json({ status: 'pending' })

  // Payment confirmed — flip status (idempotent: only the caller that wins the
  // pending→confirmed transition proceeds to send notifications)
  const { data: updated } = await supabase
    .from('lp_guest_orders')
    .update({ status: 'confirmed', payment_status: 'paid' })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (!updated) return NextResponse.json({ status: 'confirmed' }) // already processed by webhook

  const lp = order as any
  const lpTitle = lp.landing_pages?.title ?? 'SyababFresh'
  const itemLines = ((lp.items as any[]) ?? [])
    .map((i: any) => `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} × ${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`)
    .join('\n')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

  // WhatsApp to customer
  sendWhatsApp(lp.phone, [
    `Terima kasih ${lp.name}! 🌿`,
    ``,
    `✅ *Bayaran FPX Diterima*`,
    `📦 No. Pesanan: *${lp.order_number}*`,
    `🛍️ ${lpTitle}`,
    ``,
    itemLines,
    ``,
    `💰 Jumlah: *RM${Number(lp.total).toFixed(2)}*`,
    ``,
    `Daftar akaun untuk track order & dapat loyalty points:`,
    `👉 ${appUrl}/daftar`,
    ``,
    `SyababFresh 🌿`,
  ].join('\n')).catch(() => {})

  // WhatsApp + push to admin
  const adminPhone = process.env.ADMIN_WHATSAPP
  if (adminPhone) {
    sendWhatsApp(adminPhone, [
      `🛒 *Pesanan LP Baru — ${lp.order_number}*`,
      ``,
      `👤 *Pelanggan:* ${lp.name}`,
      `📱 *Telefon:* ${lp.phone}`,
      `🛍️ ${lpTitle}`,
      ``,
      itemLines,
      ``,
      `💰 *Jumlah:* RM${Number(lp.total).toFixed(2)}`,
      `💳 *Bayaran:* FPX ✅ Dibayar`,
    ].join('\n')).catch(() => {})
    sendAdminPush({
      title: `💳 LP FPX Dibayar — ${lp.order_number}`,
      body: `${lp.name} · RM${Number(lp.total).toFixed(2)}`,
      url: '/admin/fulfillment',
      tag: 'payment-confirmed',
    }).catch(() => {})
  }

  return NextResponse.json({ status: 'confirmed', justConfirmed: true })
}
