export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { JadiEjenClient } from './jadi-ejen-client'

async function getStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminDb = createAdminClient()
  const { data: setting } = await adminDb
    .from('app_settings')
    .select('value')
    .eq('key', 'affiliate_commission_pct')
    .single()
  const commissionPct = parseFloat(setting?.value ?? '0.01') * 100

  if (!user) return { status: 'guest' as const, commissionPct }

  const { data: profile } = await adminDb
    .from('profiles')
    .select('full_name, phone, is_affiliate')
    .eq('id', user.id)
    .single()

  if (profile?.is_affiliate) redirect('/affiliate')

  const { data: application } = await adminDb
    .from('affiliate_applications')
    .select('id, status, admin_note')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    status: (application?.status ?? 'none') as 'none' | 'pending' | 'approved' | 'rejected',
    adminNote: application?.admin_note ?? null,
    commissionPct,
    userName: profile?.full_name ?? null,
  }
}

export default async function JadiEjenPage() {
  const data = await getStatus()
  return <JadiEjenClient {...data} />
}
