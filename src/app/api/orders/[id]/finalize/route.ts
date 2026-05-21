import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCapiPurchase } from '@/lib/meta-capi'

// POST /api/orders/[id]/finalize
// Deducts inventory + loyalty points + promo uses for COD/bank_transfer orders.
// Moved server-side so client cannot skip or manipulate these operations.
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

  // Fetch order — verify ownership and that it hasn't been finalized yet
  const { data: order } = await supabase
    .from('orders')
    .select('id, user_id, order_number, status, payment_method, payment_status, total, points_used, promo_code_id, order_items(product_id, variant_id, quantity, unit_price)')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Only finalize COD / bank_transfer orders that are still pending
  if (!['cod', 'bank_transfer'].includes(order.payment_method)) {
    return NextResponse.json({ error: 'Not applicable' }, { status: 400 })
  }
  if (order.status !== 'pending') {
    // Already finalized (or cancelled) — idempotent, just return ok
    return NextResponse.json({ ok: true })
  }

  // ── Deduct inventory ─────────────────────────────────────────────
  const items = order.order_items as any[]
  const deductResults = await Promise.all(
    items.map((item: any) =>
      item.variant_id
        ? supabase.rpc('deduct_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity })
        : supabase.rpc('deduct_inventory', { p_product_id: item.product_id, p_quantity: item.quantity })
    )
  )

  const oversold = items.filter((_: any, i: number) => deductResults[i].error)
  if (oversold.length > 0) {
    // Cancel order if stock insufficient
    await supabase.from('orders')
      .update({ status: 'cancelled', admin_notes: `Stok tidak mencukupi: ${oversold.map((i: any) => i.product_id).join(', ')}` })
      .eq('id', orderId)
    return NextResponse.json(
      { error: `Stok tidak mencukupi untuk ${oversold.length} item. Pesanan dibatalkan.` },
      { status: 409 }
    )
  }

  // ── Loyalty points ───────────────────────────────────────────────
  const pointsUsed = order.points_used ?? 0
  const total = Number(order.total)

  // Get user's loyalty multiplier
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, phone, loyalty_tiers(multiplier)')
    .eq('id', user.id)
    .single()
  const multiplier = (profile as any)?.loyalty_tiers?.multiplier ?? 1

  if (pointsUsed > 0) {
    await supabase.from('loyalty_transactions').insert({
      user_id: user.id, order_id: orderId,
      points: -pointsUsed, type: 'redeem',
      description: `Redeem ${pointsUsed} mata untuk pesanan`,
    })
    await supabase.rpc('increment_points', { uid: user.id, pts: -pointsUsed })
  }

  const MAX_POINTS = 5000
  const earned = Math.min(Math.floor(total * multiplier), MAX_POINTS)
  await supabase.from('loyalty_transactions').insert({
    user_id: user.id, order_id: orderId,
    points: earned, type: 'earn', description: 'Pembelian',
  })
  await Promise.all([
    supabase.rpc('increment_points', { uid: user.id, pts: earned }),
    supabase.rpc('increment_spend', { uid: user.id, amount: total }),
  ])

  // ── Promo usage ──────────────────────────────────────────────────
  if (order.promo_code_id) {
    await supabase.rpc('increment_promo_uses', { promo_id: order.promo_code_id })
  }

  sendCapiPurchase({
    orderId,
    orderNumber: (order as any).order_number,
    total: Number(order.total),
    items: (order.order_items as any[]).map((i: any) => ({
      productId: i.product_id,
      quantity: i.quantity,
      price: Number(i.unit_price ?? 0),
    })),
    userEmail: (profile as any)?.email,
    userPhone: (profile as any)?.phone,
    userId: user.id,
    clientIp,
    userAgent,
    fbc,
    fbp,
  }).catch(() => {})

  return NextResponse.json({ ok: true, earnedPoints: earned })
}
