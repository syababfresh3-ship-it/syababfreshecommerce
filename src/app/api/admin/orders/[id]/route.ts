import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function processReferralReward(supabase: ReturnType<typeof createAdminClient>, userId: string, orderId: string) {
  const { data: referral } = await supabase
    .from('referrals')
    .select('id, referrer_id, referrer_pts')
    .eq('referee_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!referral) return

  // Award referrer
  await supabase.from('loyalty_transactions').insert({
    user_id: referral.referrer_id,
    points: referral.referrer_pts,
    type: 'earn',
    description: 'Ganjaran rujukan — rakan anda buat pesanan pertama!',
  })
  await supabase.rpc('increment_points', { uid: referral.referrer_id, pts: referral.referrer_pts })

  // Mark referral rewarded
  await supabase
    .from('referrals')
    .update({ status: 'rewarded', order_id: orderId, rewarded_at: new Date().toISOString() })
    .eq('id', referral.id)
}

async function processAffiliateCommission(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  orderId: string,
  orderTotal: number,
) {
  // Find referrer for this user
  const { data: referral } = await supabase
    .from('referrals')
    .select('referrer_id')
    .eq('referee_id', userId)
    .maybeSingle()

  if (!referral) return

  // Check if referrer is an affiliate
  const { data: referrer } = await supabase
    .from('profiles')
    .select('is_affiliate')
    .eq('id', referral.referrer_id)
    .single()

  if (!referrer?.is_affiliate) return

  // Avoid duplicate commission for same order
  const { data: existing } = await supabase
    .from('affiliate_commissions')
    .select('id')
    .eq('affiliate_id', referral.referrer_id)
    .eq('order_id', orderId)
    .maybeSingle()

  if (existing) return

  // Get commission rate from app_settings
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'affiliate_commission_pct')
    .single()

  const rate = parseFloat(setting?.value ?? '0.01')
  const amount = Math.round(orderTotal * rate * 100) / 100

  await supabase.from('affiliate_commissions').insert({
    affiliate_id: referral.referrer_id,
    order_id: orderId,
    order_total: orderTotal,
    rate,
    amount,
    status: 'pending',
  })

  await supabase.rpc('increment_affiliate_balance', { uid: referral.referrer_id, amt: amount })
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
  const { status, payment_status, payment_ref } = body

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

  // Fetch order before updating (needed for referral + affiliate)
  let orderData: { user_id: string; total: number } | null = null
  if (status === 'delivered') {
    const { data: order } = await supabase
      .from('orders')
      .select('user_id, total')
      .eq('id', id)
      .single()
    orderData = order ?? null
  }

  const { error } = await supabase.from('orders').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (status === 'delivered' && orderData) {
    await processReferralReward(supabase, orderData.user_id, id)
    await processAffiliateCommission(supabase, orderData.user_id, id, orderData.total)
  }

  return NextResponse.json({ ok: true })
}
