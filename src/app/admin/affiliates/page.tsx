export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { AffiliatesClient } from './affiliates-client'

async function getData() {
  const supabase = createAdminClient()

  const [profilesRes, withdrawalsRes, settingRes] = await Promise.all([
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
  ])

  return {
    profiles: profilesRes.data ?? [],
    withdrawals: withdrawalsRes.data ?? [],
    commissionPct: parseFloat(settingRes.data?.value ?? '0.01'),
  }
}

export default async function AdminAffiliatesPage() {
  const data = await getData()
  return <AffiliatesClient {...data} />
}
