export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { StoreLayout } from '@/components/layout/store-layout'
import { redirect } from 'next/navigation'
import { AffiliateDashboard } from './affiliate-dashboard'

async function getAffiliateData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminDb = createAdminClient()
  const [profileRes, commissionsRes, withdrawalsRes, settingRes, referralsRes] = await Promise.all([
    adminDb.from('profiles').select('full_name, is_affiliate, affiliate_balance, referral_code').eq('id', user.id).single(),
    adminDb.from('affiliate_commissions').select('id, order_id, order_total, rate, amount, status, created_at').eq('affiliate_id', user.id).order('created_at', { ascending: false }),
    adminDb.from('affiliate_withdrawals').select('id, amount, bank_name, bank_account, account_name, status, requested_at, processed_at, admin_note').eq('affiliate_id', user.id).order('requested_at', { ascending: false }),
    adminDb.from('app_settings').select('value').eq('key', 'affiliate_commission_pct').single(),
    adminDb.from('referrals').select('id, status, created_at, referee_id, referee:profiles!referrals_referee_id_fkey(id, full_name)').eq('referrer_id', user.id).order('created_at', { ascending: false }),
  ])

  const referrals = referralsRes.data ?? []
  const refereeIds = referrals.map(r => (r.referee as any)?.id).filter(Boolean)
  const commissionRate = parseFloat(settingRes.data?.value ?? '0.01')

  // Upcoming commissions: in-progress orders from referred customers
  let upcomingOrders: any[] = []
  if (refereeIds.length > 0) {
    const { data } = await adminDb
      .from('orders')
      .select('id, total, status, user_id')
      .in('user_id', refereeIds)
      .in('status', ['confirmed', 'preparing', 'delivering'])
      .neq('payment_status', 'refunded')
    upcomingOrders = (data ?? []).map(o => ({
      ...o,
      estimatedCommission: Math.round(Number(o.total) * commissionRate * 100) / 100,
    }))
  }

  return {
    profile: profileRes.data,
    commissions: commissionsRes.data ?? [],
    withdrawals: withdrawalsRes.data ?? [],
    commissionRate,
    referrals,
    upcomingOrders,
  }
}

export default async function AffiliatePage() {
  const data = await getAffiliateData()
  if (!data) redirect('/login?redirect=/affiliate')
  if (!data.profile?.is_affiliate) redirect('/loyalty')

  return (
    <StoreLayout>
      <AffiliateDashboard
        profile={data.profile}
        commissions={data.commissions}
        withdrawals={data.withdrawals}
        commissionRate={data.commissionRate}
        referrals={data.referrals}
        upcomingOrders={data.upcomingOrders}
      />
    </StoreLayout>
  )
}
