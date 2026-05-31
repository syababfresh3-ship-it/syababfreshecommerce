import type { SupabaseClient } from '@supabase/supabase-js'

// Reverse loyalty for a refunded order:
//   - cancel the points the customer EARNED from this order
//   - give back the points the customer REDEEMED on this order
//   - subtract the order total from their lifetime spend (only if it was counted)
// Idempotent: a prior 'adjustment' transaction for the order short-circuits a re-run.
export async function reverseOrderLoyalty(
  supabase: SupabaseClient,
  order: { id: string; order_number: string; user_id: string; total: number | string }
): Promise<{ reversed: boolean; net?: number; reason?: string }> {
  // Already reversed?
  const { data: existing } = await supabase
    .from('loyalty_transactions')
    .select('id')
    .eq('order_id', order.id)
    .eq('type', 'adjustment')
    .limit(1)
  if (existing && existing.length) return { reversed: false, reason: 'already_reversed' }

  // What did this order actually move?
  const { data: txs } = await supabase
    .from('loyalty_transactions')
    .select('points, type')
    .eq('order_id', order.id)
  const earned = (txs ?? []).filter(t => t.type === 'earn').reduce((a, t) => a + t.points, 0)
  const redeemedNeg = (txs ?? []).filter(t => t.type === 'redeem').reduce((a, t) => a + t.points, 0) // negative
  if (earned === 0 && redeemedNeg === 0) return { reversed: false, reason: 'no_loyalty' }

  // Reverse earned (−earned) and give back redeemed (−redeemedNeg, which is positive)
  const net = -earned - redeemedNeg
  await supabase.from('loyalty_transactions').insert({
    user_id: order.user_id,
    order_id: order.id,
    points: net,
    type: 'adjustment',
    description: `Refund ${order.order_number} — reverse loyalty (earned ${earned}, redeem ${-redeemedNeg})`,
  })
  await supabase.rpc('increment_points', { uid: order.user_id, pts: net })
  // Spend was only ever added when points were earned — only reverse it then
  if (earned > 0) {
    await supabase.rpc('increment_spend', { uid: order.user_id, amount: -Number(order.total) })
  }
  return { reversed: true, net }
}

// Reverse loyalty for a cancelled/refunded LP guest order. LP loyalty transactions
// carry no order_id (FK points at public.orders), so we locate them by order number
// in the description. Reverses BOTH earned (on delivery) and redeemed (logged-in)
// points. Idempotent via a prior `Refund LP <no>` adjustment.
export async function reverseLpLoyalty(
  supabase: SupabaseClient,
  lp: { id: string; order_number: string; total: number | string }
): Promise<{ reversed: boolean; reason?: string }> {
  // Already reversed?
  const { data: rev } = await supabase
    .from('loyalty_transactions')
    .select('id')
    .ilike('description', `Refund LP ${lp.order_number}%`)
    .limit(1)
  if (rev && rev.length) return { reversed: false, reason: 'already_reversed' }

  const [{ data: earns }, { data: redeems }] = await Promise.all([
    supabase.from('loyalty_transactions').select('user_id, points').eq('type', 'earn').ilike('description', `Pembelian LP ${lp.order_number}%`),
    supabase.from('loyalty_transactions').select('user_id, points').eq('type', 'redeem').ilike('description', `Redeem % LP ${lp.order_number}%`),
  ])

  const earned = (earns ?? []).reduce((a, t) => a + t.points, 0)        // positive
  const redeemedNeg = (redeems ?? []).reduce((a, t) => a + t.points, 0) // negative
  if (earned === 0 && redeemedNeg === 0) return { reversed: false, reason: 'no_loyalty' }

  const userId = (earns?.[0]?.user_id ?? redeems?.[0]?.user_id) as string | undefined
  if (!userId) return { reversed: false, reason: 'no_loyalty' }

  // Remove earned (−earned) + give back redeemed (−redeemedNeg = positive)
  const net = -earned - redeemedNeg
  await supabase.from('loyalty_transactions').insert({
    user_id: userId,
    order_id: null,
    points: net,
    type: 'adjustment',
    description: `Refund LP ${lp.order_number} — reverse loyalty (earned ${earned}, redeem ${-redeemedNeg})`,
  })
  await supabase.rpc('increment_points', { uid: userId, pts: net })
  // Spend was only added when points were EARNED (on delivery) — only reverse it then
  if (earned > 0) {
    await supabase.rpc('increment_spend', { uid: userId, amount: -Number(lp.total) })
  }
  return { reversed: true }
}
