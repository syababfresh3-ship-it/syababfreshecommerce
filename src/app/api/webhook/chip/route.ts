import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
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
      delivery_address, notes, points_used, promo_code_id,
      order_items(product_id, variant_id, product_name, quantity, unit_price),
      profiles(full_name, phone, loyalty_tiers(multiplier))
    `)
    .single()

  if (!updated) {
    return NextResponse.json({ ok: true })
  }

  const {
    user_id, total, order_number, payment_method, delivery_address, notes,
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
  const earnedPoints = Math.floor(Number(total) * multiplier)
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
