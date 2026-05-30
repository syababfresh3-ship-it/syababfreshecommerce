import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppSettings } from '@/lib/app-settings'
import { sendWhatsApp } from '@/lib/murpati'
import { awardOrderLoyalty } from '@/lib/loyalty-award'

// An order counts as "settled" — and therefore eligible to earn loyalty — when:
//   - it was paid online (payment_status === 'paid'), OR
//   - it is COD / bank_transfer, where money changes hands on delivery itself
//     (those orders stay payment_status='unpaid' but delivery means cash received).
// Online methods (fpx / ewallet) that are still unpaid never earn points.
export function isOrderSettled(payment_method: string | null, payment_status: string | null): boolean {
  if (payment_status === 'paid') return true
  return payment_method === 'cod' || payment_method === 'bank_transfer'
}

async function processReferralReward(supabase: SupabaseClient, userId: string, orderId: string) {
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

  // Notify referrer via WhatsApp
  const [referrerRes, refereeRes] = await Promise.all([
    supabase.from('profiles').select('phone').eq('id', referral.referrer_id).single(),
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
  ])
  if (referrerRes.data?.phone) {
    const refereeName = refereeRes.data?.full_name ?? 'Rakan anda'
    sendWhatsApp(referrerRes.data.phone, [
      `🎉 *Tahniah! Ganjaran Rujukan Diterima*`,
      ``,
      `*${refereeName}* baru sahaja selesai buat pesanan pertama guna kod rujukan anda!`,
      ``,
      `✨ *+${referral.referrer_pts} mata* telah dikreditkan ke akaun anda.`,
      ``,
      `Teruskan kongsi link rujukan untuk dapatkan lebih banyak ganjaran! 🍒`,
    ].join('\n')).catch(() => {})
  }
}

async function processAffiliateCommission(
  supabase: SupabaseClient,
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

  const appSettings = await getAppSettings()
  const rate = parseFloat(appSettings.affiliate_commission_pct ?? '0.01')
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

// Single source of truth for everything that must happen when a regular order
// reaches 'delivered'. Call this from EVERY path that transitions an order to
// 'delivered' (admin orders PATCH, shipping module, …) so behaviour stays
// consistent. Every side-effect is idempotent, so repeat calls are safe.
//
// Pass a service-role client (createAdminClient) — the loyalty/affiliate RPCs and
// cross-user inserts require it.
export async function handleOrderDelivered(supabase: SupabaseClient, orderId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('user_id, total, order_number, payment_method, payment_status')
    .eq('id', orderId)
    .single()
  if (!order) return

  // Earn points + spend — but only for settled orders (don't reward unpaid online orders)
  if (isOrderSettled(order.payment_method, order.payment_status)) {
    await awardOrderLoyalty(supabase, {
      id: orderId,
      user_id: order.user_id,
      order_number: order.order_number,
      total: order.total,
    })
  }
  await processReferralReward(supabase, order.user_id, orderId)
  await processAffiliateCommission(supabase, order.user_id, orderId, Number(order.total))
}
