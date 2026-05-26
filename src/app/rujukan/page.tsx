export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { StoreLayout } from '@/components/layout/store-layout'
import { redirect } from 'next/navigation'
import { RujukanClient } from './rujukan-client'

async function getData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminDb = createAdminClient()
  const [profileRes, referralsRes] = await Promise.all([
    adminDb.from('profiles').select('full_name, referral_code, total_points').eq('id', user.id).single(),
    adminDb
      .from('referrals')
      .select('id, status, referee_pts, referrer_pts, created_at, rewarded_at, referee:profiles!referrals_referee_id_fkey(full_name)')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return {
    profile: profileRes.data,
    referrals: referralsRes.data ?? [],
  }
}

export default async function RujukanPage() {
  const data = await getData()
  if (!data) redirect('/login?redirect=/rujukan')
  return (
    <StoreLayout>
      <RujukanClient profile={data.profile} referrals={data.referrals} />
    </StoreLayout>
  )
}
