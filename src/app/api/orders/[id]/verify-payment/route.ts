import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'
import { sendCapiPurchase } from '@/lib/meta-capi'
import { sendPaymentConfirmedEmail } from '@/lib/zeptomail'

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const forwarded = req.headers.get('x-forwarded-for')
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? null)
  const userAgent = req.headers.get('user-agent') ?? null
  const cookieHeader = req.headers.get('cookie') ?? ''
  const fbc = cookieHeader.match(/(?:^|;\s*)_fbc=([^;]+)/)?.[1] ?? null
  const fbp = cookieHeader.match(/(?:^|;\s*)_fbp=([^;]+)/)?.[1] ?? null

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, user_id, order_number, total, payment_method, payment_status, payment_ref,
      delivery_address, delivery_slot, notes, points_used, promo_code_id,
      order_items(product_id, variant_id, product_name, quantity, unit_price, variant_name),
      profiles(full_name, phone, email, loyalty_tiers(multiplier))
    `)
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order tidak dijumpai' }, { status: 404 })

  // Already paid — nothing to do
  if (order.payment_status === 'paid') return NextResponse.json({ status: 'paid' })

  // Only verify FPX/online payment methods
  if (!['fpx', 'ewallet', 'online'].includes(order.payment_method)) {
    return NextResponse.json({ status: order.payment_status })
  }

  // Query Chip API using stored purchase ID
  const purchaseId = order.payment_ref
  if (!purchaseId || !process.env.CHIP_SECRET_KEY) {
    return NextResponse.json({ status: 'unpaid', reason: 'no_ref' })
  }

  const chipRes = await fetch(`${CHIP_API_URL}/purchases/${purchaseId}/`, {
    headers: { Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}` },
  })

  if (!chipRes.ok) return NextResponse.json({ status: 'unpaid', reason: 'chip_error' })

  const purchase = await chipRes.json()

  // Chip status: 'paid' means payment confirmed
  if (purchase.status !== 'paid') {
    return NextResponse.json({ status: 'unpaid' })
  }

  // Payment confirmed — update order (idempotent)
  const { data: updated } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('payment_status', 'unpaid')
    .select('id')
    .single()

  if (!updated) return NextResponse.json({ status: 'paid' }) // already processed

  const { order_items, profiles } = order as any
  const multiplier = profiles?.loyalty_tiers?.multiplier ?? 1

  // Deduct inventory
  await Promise.all(
    (order_items ?? []).map((item: any) =>
      item.variant_id
        ? supabase.rpc('deduct_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity })
        : supabase.rpc('deduct_inventory', { p_product_id: item.product_id, p_quantity: item.quantity })
    )
  )

  // Loyalty points
  if (order.points_used > 0) {
    await supabase.from('loyalty_transactions').insert({ user_id: user.id, order_id: orderId, points: -order.points_used, type: 'redeem', description: `Redeem ${order.points_used} mata untuk ${order.order_number}` })
    await supabase.rpc('increment_points', { uid: user.id, pts: -order.points_used })
  }
  const earned = Math.min(Math.floor(Number(order.total) * multiplier), 5000)
  await supabase.from('loyalty_transactions').insert({ user_id: user.id, order_id: orderId, points: earned, type: 'earn', description: `Pembelian ${order.order_number}` })
  await Promise.all([
    supabase.rpc('increment_points', { uid: user.id, pts: earned }),
    supabase.rpc('increment_spend', { uid: user.id, amount: Number(order.total) }),
  ])
  if (order.promo_code_id) await supabase.rpc('increment_promo_uses', { promo_id: order.promo_code_id })

  sendCapiPurchase({
    orderId,
    orderNumber: order.order_number,
    total: Number(order.total),
    items: (order_items ?? []).map((i: any) => ({
      productId: i.product_id,
      quantity: i.quantity,
      price: Number(i.unit_price ?? 0),
    })),
    userEmail: profiles?.email,
    userPhone: profiles?.phone,
    userId: user.id,
    customerName: profiles?.full_name ?? null,
    clientIp,
    userAgent,
    fbc,
    fbp,
  }).catch(() => {})

  // Email customer
  if (profiles?.email) {
    sendPaymentConfirmedEmail({
      to: profiles.email,
      customerName: profiles.full_name ?? 'Pelanggan',
      orderNumber: order.order_number,
      items: (order_items ?? []).map((i: any) => ({ name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, variant_name: i.variant_name ?? null })),
      total: Number(order.total),
      deliveryAddress: order.delivery_address ?? null,
      deliverySlot: order.delivery_slot ?? null,
      notes: order.notes ?? null,
    }).catch(() => {})
  }

  // Notify admin WhatsApp
  const adminPhone = process.env.ADMIN_WHATSAPP
  if (adminPhone) {
    const itemLines = (order_items ?? []).map((i: any) => `• ${i.product_name} x${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`).join('\n')
    sendWhatsApp(adminPhone, [
      `🛒 *Pesanan Baru — ${order.order_number}*`,
      ``,
      `👤 *Pelanggan:* ${profiles?.full_name ?? '—'}`,
      `📱 *Telefon:* ${profiles?.phone ?? '—'}`,
      ``,
      `🧺 *Item:*\n${itemLines}`,
      ``,
      `💰 *Jumlah:* RM${Number(order.total).toFixed(2)}`,
      `💳 *Bayaran:* FPX ✅ Dibayar`,
      `📍 *Alamat:*\n${order.delivery_address ?? '—'}`,
    ].join('\n')).catch(() => {})
  }

  return NextResponse.json({ status: 'paid', justConfirmed: true })
}
