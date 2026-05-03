import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'
import { createHmac } from 'crypto'
import { sendPaymentConfirmedEmail } from '@/lib/zeptomail'

export async function POST(req: NextRequest) {
  let rawBody: string
  let body: any
  try {
    rawBody = await req.text()
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Verify CHIP webhook signature — mandatory, no fallback
  const secret = process.env.CHIP_SECRET_KEY
  if (!secret) {
    console.error('[chip-webhook] CHIP_SECRET_KEY not configured')
    return NextResponse.json({ error: 'Payment gateway misconfigured' }, { status: 503 })
  }
  const signature = req.headers.get('x-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { event_type, purchase } = body

  if (event_type !== 'purchase.paid') {
    return NextResponse.json({ ok: true })
  }

  const orderId = purchase?.reference
  if (!orderId) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()

  // Idempotency — only process if still unpaid
  const { data: updated } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', status: 'confirmed' })
    .eq('id', orderId)
    .eq('payment_status', 'unpaid')
    .select(`
      id, user_id, total, order_number, payment_method,
      delivery_address, delivery_slot, notes, points_used, promo_code_id,
      order_items(product_id, variant_id, product_name, quantity, unit_price, variant_name),
      profiles(full_name, phone, email, loyalty_tiers(multiplier))
    `)
    .single()

  if (!updated) {
    return NextResponse.json({ ok: true })
  }

  const {
    user_id, total, order_number, payment_method, delivery_address, delivery_slot, notes,
    points_used, promo_code_id, order_items, profiles,
  } = updated as any

  const multiplier = profiles?.loyalty_tiers?.multiplier ?? 1

  // Deduct inventory per item — variant items use deduct_variant_stock, others use FIFO batches
  const deductResults = await Promise.all(
    (order_items ?? []).map((item: any) =>
      item.variant_id
        ? supabase.rpc('deduct_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity })
        : supabase.rpc('deduct_inventory', { p_product_id: item.product_id, p_quantity: item.quantity })
    )
  )

  const oversoldItems = (order_items ?? []).filter((_: any, i: number) => deductResults[i].error)
  if (oversoldItems.length > 0) {
    const names = oversoldItems.map((i: any) => i.product_name).join(', ')
    await supabase
      .from('orders')
      .update({ admin_notes: `⚠️ STOK TIDAK MENCUKUPI: ${names}. Hubungi pelanggan.` })
      .eq('id', orderId)
  }

  // Deduct loyalty points used (points_used stored on order, safe to apply now that payment confirmed)
  if (points_used > 0) {
    await supabase.from('loyalty_transactions').insert({
      user_id,
      order_id: orderId,
      points: -points_used,
      type: 'redeem',
      description: `Redeem ${points_used} mata untuk ${order_number}`,
    })
    await supabase.rpc('increment_points', { uid: user_id, pts: -points_used })
  }

  // Award earned loyalty points
  const MAX_POINTS_PER_ORDER = 5000
  const earnedPoints = Math.min(Math.floor(Number(total) * multiplier), MAX_POINTS_PER_ORDER)
  await supabase.from('loyalty_transactions').insert({
    user_id,
    order_id: orderId,
    points: earnedPoints,
    type: 'earn',
    description: `Pembelian ${order_number}`,
  })
  await Promise.all([
    supabase.rpc('increment_points', { uid: user_id, pts: earnedPoints }),
    supabase.rpc('increment_spend', { uid: user_id, amount: Number(total) }),
  ])

  // Increment promo usage now that payment is confirmed
  if (promo_code_id) {
    await supabase.rpc('increment_promo_uses', { promo_id: promo_code_id })
  }

  // Send payment confirmed email to customer
  const customerEmail = profiles?.email
  if (customerEmail) {
    sendPaymentConfirmedEmail({
      to: customerEmail,
      customerName: profiles?.full_name ?? 'Pelanggan',
      orderNumber: order_number,
      items: (order_items ?? []).map((i: any) => ({
        name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        variant_name: i.variant_name ?? null,
      })),
      total: Number(total),
      deliveryAddress: delivery_address ?? null,
      deliverySlot: delivery_slot ?? null,
      notes: notes ?? null,
    }).catch(err => console.error('[chip-webhook] email error:', err))
  }

  // Notify admin via WhatsApp
  const adminPhone = process.env.ADMIN_WHATSAPP
  if (adminPhone) {
    const paymentLabel: Record<string, string> = {
      fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Pindahan Bank',
    }
    const itemLines = (order_items ?? [])
      .map((i: any) => `• ${i.product_name} x${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`)
      .join('\n')
    const stockWarning = oversoldItems.length > 0
      ? `\n\n⚠️ *STOK TIDAK MENCUKUPI:* ${oversoldItems.map((i: any) => i.product_name).join(', ')}`
      : ''
    const message = [
      `🛒 *Pesanan Baru — ${order_number}*`,
      ``,
      `👤 *Pelanggan:* ${profiles?.full_name ?? '—'}`,
      `📱 *Telefon:* ${profiles?.phone ?? '—'}`,
      ``,
      `🧺 *Item:*`,
      itemLines,
      ``,
      `💰 *Jumlah:* RM${Number(total).toFixed(2)}`,
      `💳 *Bayaran:* ${paymentLabel[payment_method] ?? payment_method} ✅ Dibayar`,
      ``,
      `📍 *Alamat:*`,
      delivery_address ?? '—',
      notes ? `\n📝 *Nota:* ${notes}` : '',
      stockWarning,
    ].filter(Boolean).join('\n')
    sendWhatsApp(adminPhone, message).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
