import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { confirmLpGuestOrder } from '@/lib/order-confirm'

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
    .select('id, status, payment_method, payment_ref')
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

  // Payment confirmed — shared idempotent confirm (flip + promo/points + notify).
  const result = await confirmLpGuestOrder(supabase, orderId)
  return NextResponse.json({ status: 'confirmed', justConfirmed: result === 'confirmed' })
}
