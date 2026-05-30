import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendOrderConfirmationEmail } from '@/lib/zeptomail'
import { reverseOrderLoyalty } from '@/lib/loyalty-reverse'
import { handleOrderDelivered } from '@/lib/order-delivered'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, total, payment_status, payment_method, delivery_address, delivery_slot, notes, created_at, updated_at, admin_notes,
      order_items(id, product_name, variant_name, quantity, unit_price, subtotal),
      profiles(full_name, phone, email)
    `)
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { status, payment_status, payment_ref, action } = body

  // ── First-order approval / rejection ─────────────────────────────
  if (action === 'approve' || action === 'reject') {
    const { data: order } = await supabase
      .from('orders')
      .select('id, user_id, total, needs_approval, payment_method, delivery_address, delivery_slot, notes, order_number, order_items(product_id, variant_id, quantity, product_name, unit_price, variant_name), profiles(full_name, email)')
      .eq('id', id)
      .single()

    if (!order || !order.needs_approval) {
      return NextResponse.json({ error: 'Pesanan tidak memerlukan kelulusan' }, { status: 400 })
    }

    if (action === 'reject') {
      await supabase.from('orders').update({
        status: 'cancelled',
        needs_approval: false,
        cancelled_at: new Date().toISOString(),
      }).eq('id', id)
      return NextResponse.json({ ok: true })
    }

    // Approve: deduct inventory then confirm
    const items = order.order_items as any[]
    const deductResults = await Promise.all(
      items.map((item: any) =>
        item.variant_id
          ? supabase.rpc('deduct_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity })
          : supabase.rpc('deduct_inventory', { p_product_id: item.product_id, p_quantity: item.quantity })
      )
    )

    const failedItems = items.filter((_: any, i: number) => deductResults[i].error)
    if (failedItems.length > 0) {
      await supabase.from('orders').update({
        admin_notes: `⚠️ STOK TIDAK MENCUKUPI semasa lulus pesanan. Hubungi pelanggan.`,
      }).eq('id', id)
    }

    await supabase.from('orders').update({
      status: 'confirmed',
      needs_approval: false,
      confirmed_at: new Date().toISOString(),
    }).eq('id', id)

    // Send confirmation email to customer now that order is approved
    const profile = (order as any).profiles
    if (profile?.email) {
      sendOrderConfirmationEmail({
        to: profile.email,
        customerName: profile.full_name ?? 'Pelanggan',
        orderNumber: (order as any).order_number,
        items: ((order as any).order_items ?? []).map((i: any) => ({
          name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          variant_name: i.variant_name ?? null,
        })),
        total: Number((order as any).total),
        deliveryAddress: (order as any).delivery_address ?? null,
        deliverySlot: (order as any).delivery_slot ?? null,
        paymentMethod: (order as any).payment_method,
        notes: (order as any).notes ?? null,
      }).catch(err => console.error('[admin-approve] email error:', err))
    }

    return NextResponse.json({ ok: true })
  }

  // ── Normal status update ──────────────────────────────────────────
  const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled', 'refunded']
  const VALID_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded', 'failed']

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  if (payment_status && !VALID_PAYMENT_STATUSES.includes(payment_status)) {
    return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const update: Record<string, string | null> = {}

  if (status) {
    update.status = status
    if (status === 'confirmed')  update.confirmed_at  = now
    if (status === 'preparing')  update.preparing_at  = now
    if (status === 'delivering') update.delivering_at = now
    if (status === 'delivered')  update.delivered_at  = now
    if (status === 'cancelled')  update.cancelled_at  = now
    if (status === 'refunded')   update.payment_status = 'refunded'
  }
  if (payment_status) update.payment_status = payment_status
  if (payment_ref !== undefined) update.payment_ref = payment_ref

  const { error } = await supabase.from('orders').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delivered side-effects (loyalty + referral + affiliate) — shared with the
  // shipping module so every 'delivered' path behaves identically. Idempotent.
  if (status === 'delivered') {
    await handleOrderDelivered(supabase, id)
  }

  // On refund: reverse earned points + spend, give back redeemed points
  if (status === 'refunded') {
    const { data: orderData } = await supabase
      .from('orders')
      .select('user_id, total, order_number')
      .eq('id', id)
      .single()
    if (orderData?.user_id) {
      await reverseOrderLoyalty(supabase, { id, ...orderData })
    }
  }

  return NextResponse.json({ ok: true })
}
