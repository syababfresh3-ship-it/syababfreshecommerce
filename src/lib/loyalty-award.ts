import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_POINTS_PER_ORDER = 5000

// Award earned loyalty points + spend for a regular order. Called when the order is
// marked delivered (points are earned on fulfilment, not at payment). Idempotent —
// the `loyalty_awarded` flag is claimed atomically so the points are granted at most
// once even across concurrent delivered triggers (admin PATCH / shipping module).
export async function awardOrderLoyalty(
  supabase: SupabaseClient,
  order: { id: string; user_id: string; order_number: string; total: number | string }
): Promise<{ awarded: boolean; points?: number }> {
  // Claim the award — only the first caller flips the flag from false → true
  const { data: claimed } = await supabase
    .from('orders')
    .update({ loyalty_awarded: true })
    .eq('id', order.id)
    .eq('loyalty_awarded', false)
    .select('id')
    .maybeSingle()
  if (!claimed) return { awarded: false } // already awarded

  const { data: profile } = await supabase
    .from('profiles')
    .select('loyalty_tiers(multiplier)')
    .eq('id', order.user_id)
    .single()
  const multiplier = (profile as any)?.loyalty_tiers?.multiplier ?? 1
  const points = Math.min(Math.floor(Number(order.total) * multiplier), MAX_POINTS_PER_ORDER)

  await supabase.from('loyalty_transactions').insert({
    user_id: order.user_id,
    order_id: order.id,
    points,
    type: 'earn',
    description: `Pembelian ${order.order_number}`,
  })
  await Promise.all([
    supabase.rpc('increment_points', { uid: order.user_id, pts: points }),
    supabase.rpc('increment_spend', { uid: order.user_id, amount: Number(order.total) }),
  ])
  return { awarded: true, points }
}
