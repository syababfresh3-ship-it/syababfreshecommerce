export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { AffiliatesClient } from './affiliates-client'

async function getData() {
  const supabase = createAdminClient()

  const [profilesRes, withdrawalsRes, settingRes, commissionsRes, applicationsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, is_affiliate, affiliate_balance, referral_code, created_at')
      .eq('is_admin', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('affiliate_withdrawals')
      .select('*, affiliate:profiles!affiliate_withdrawals_affiliate_id_fkey(full_name, email)')
      .order('requested_at', { ascending: false }),
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'affiliate_commission_pct')
      .single(),
    supabase
      .from('affiliate_commissions')
      .select('id, affiliate_id, order_id, order_total, rate, amount, status, created_at, affiliate:profiles!affiliate_commissions_affiliate_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('affiliate_applications')
      .select('id, user_id, status, message, admin_note, created_at, applicant:profiles!affiliate_applications_user_id_fkey(full_name, email, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ])

  return {
    profiles: profilesRes.data ?? [],
    withdrawals: withdrawalsRes.data ?? [],
    commissionPct: parseFloat(settingRes.data?.value ?? '0.01'),
    commissions: (commissionsRes.data ?? []) as any[],
    applications: (applicationsRes.data ?? []) as any[],
  }
}

export default async function AdminAffiliatesPage() {
  const data = await getData()
  return <AffiliatesClient {...data} />
}

