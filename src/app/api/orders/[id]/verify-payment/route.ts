import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCapiPurchase } from '@/lib/meta-capi'
import { confirmStorefrontOrder } from '@/lib/order-confirm'

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

// Browser fallback: when a customer returns to the success page we poll CHIP and,
// if paid, confirm the order. The DB flip + inventory + customer/admin notify are
// delegated to confirmStorefrontOrder — the same path the webhook and reconcile
// cron use — so there is one source of truth and loyalty is earned on delivery,
// not here (earning here would double-award against handleOrderDelivered).
// Meta CAPI stays in the route because it needs request-scoped data (fbp/fbc/IP/UA).
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

  // Verify ownership + read what we need for the CHIP lookup and the CAPI event.
  // No profiles embed — there is no FK orders→profiles (PostgREST would error the
  // whole statement); confirmStorefrontOrder fetches the profile separately.
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, total, payment_method, payment_status, payment_ref,
      order_items(product_id, quantity, unit_price)
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
  if (purchase.status !== 'paid') return NextResponse.json({ status: 'unpaid' })

  // Payment confirmed — flip + inventory + loyalty redeem + customer/admin notify.
  // Idempotent: only the caller that wins pending→confirmed runs the side effects.
  const result = await confirmStorefrontOrder(supabase, orderId)

  // Fire the Meta purchase event once, only when this call did the confirming, using
  // the request-scoped attribution data the shared helper can't see.
  if (result === 'confirmed') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone, email')
      .eq('id', user.id)
      .maybeSingle()
    sendCapiPurchase({
      orderId,
      orderNumber: order.order_number,
      total: Number(order.total),
      items: (order.order_items as any[] ?? []).map((i: any) => ({
        productId: i.product_id,
        quantity: i.quantity,
        price: Number(i.unit_price ?? 0),
      })),
      userEmail: profile?.email,
      userPhone: profile?.phone,
      userId: user.id,
      customerName: profile?.full_name ?? null,
      clientIp,
      userAgent,
      fbc,
      fbp,
    }).catch(() => {})
  }

  return NextResponse.json({ status: 'paid', justConfirmed: result === 'confirmed' })
}
