import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'
import { sendAdminPush } from '@/lib/push'
import { getWaTemplates, buildConfirmationMessage } from '@/lib/wa-templates'
import { sendPaymentConfirmedEmail } from '@/lib/zeptomail'

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
    .select('id, order_number, name, phone, total, items, payment_method, status, payment_ref, promo_code_id, user_id, points_used, email, address, landing_pages(title)')
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

  // Promo uses naik sekali sahaja — guard `updated` di atas pastikan hanya pemenang race buat ini
  if ((order as any).promo_code_id) {
    await supabase.rpc('increment_promo_uses', { promo_id: (order as any).promo_code_id })
  }
  // Tolak mata ditebus (FPX) — guard yang sama pastikan sekali sahaja
  if ((order as any).points_used > 0 && (order as any).user_id) {
    await supabase.from('loyalty_transactions').insert({
      user_id: (order as any).user_id, order_id: null, points: -(order as any).points_used, type: 'redeem',
      description: `Redeem ${(order as any).points_used} mata untuk LP ${order.order_number}`,
    })
    await supabase.rpc('increment_points', { uid: (order as any).user_id, pts: -(order as any).points_used })
  }

  // Loyalty points are earned on delivery (see landing-pages orders PATCH → 'delivered')
  const lp = order as any
  const lpTitle = lp.landing_pages?.title ?? 'SyababFresh'
  const itemLines = ((lp.items as any[]) ?? [])
    .map((i: any) => `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} × ${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`)
    .join('\n')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'
  const templates = await getWaTemplates()

  // WhatsApp to customer — fully template-driven (editable in /admin/settings/whatsapp)
  sendWhatsApp(lp.phone, buildConfirmationMessage(templates, 'payment_confirmed', {
    name: lp.name,
    order_number: lp.order_number,
    lp_title: lpTitle,
    items: itemLines,
    total: Number(lp.total).toFixed(2),
    app_url: appUrl,
  })).catch(() => {})

  // Email selari WA (kalau customer isi email) — guard `updated` pastikan sekali sahaja
  if (lp.email) {
    sendPaymentConfirmedEmail({
      to: lp.email,
      customerName: lp.name,
      orderNumber: lp.order_number,
      items: ((lp.items as any[]) ?? []).map((i: any) => ({ name: i.product_name, quantity: i.quantity, unit_price: Number(i.unit_price), variant_name: i.variant_name ?? null })),
      total: Number(lp.total),
      deliveryAddress: lp.address ?? null,
      deliverySlot: null,
      notes: null,
    }).catch(() => {})
  }

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
