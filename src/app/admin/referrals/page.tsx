export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminReferralsClient } from './referrals-client'

async function getReferrals() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('referrals')
    .select(`
      id, status, referee_pts, referrer_pts, rewarded_at, created_at,
      referrer:profiles!referrals_referrer_id_fkey(full_name, email, referral_code),
      referee:profiles!referrals_referee_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminReferralsPage() {
  const referrals = await getReferrals()
  return <AdminReferralsClient referrals={referrals as any[]} />
}
