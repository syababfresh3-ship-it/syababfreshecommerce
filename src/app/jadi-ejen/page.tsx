export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { JadiEjenClient } from './jadi-ejen-client'
import { getAppSettings } from '@/lib/app-settings'

async function getStatus() {
  const [supabase, settings] = await Promise.all([createClient(), getAppSettings()])
  const { data: { user } } = await supabase.auth.getUser()
  const commissionPct = parseFloat(settings['affiliate_commission_pct'] ?? '0.01') * 100

  if (!user) return { status: 'guest' as const, commissionPct }

  const adminDb = createAdminClient()
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
