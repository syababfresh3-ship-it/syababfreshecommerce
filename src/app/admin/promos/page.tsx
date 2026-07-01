export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { PromoManager } from './promo-manager'
import { IncentiveSettings } from './incentive-settings'

async function getData() {
  const supabase = createClient()
  const [{ data: promos }, { data: cfg }] = await Promise.all([
    supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
    supabase.from('app_settings').select('key, value').in('key', [
      'welcome_voucher_enabled', 'welcome_voucher_value', 'welcome_voucher_min',
      'kad_setia_enabled', 'kad_setia_target', 'kad_setia_reward',
    ]),
  ])
  const s: Record<string, string> = {}
  for (const r of cfg ?? []) s[r.key] = r.value
  return { promos: promos ?? [], s }
}

export default async function AdminPromosPage() {
  const { promos, s } = await getData()

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-end mb-3">
        <a href="/admin/promos/usage" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-100">
          📊 Penggunaan Kupon & Points
        </a>
      </div>
      <IncentiveSettings
        initial={{
          wvEnabled: s.welcome_voucher_enabled !== 'false',
          wvValue: s.welcome_voucher_value || '5',
          wvMin: s.welcome_voucher_min || '30',
          ksEnabled: s.kad_setia_enabled !== 'false',
          ksTarget: s.kad_setia_target || '9',
          ksReward: s.kad_setia_reward || '15.90',
        }}
      />
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PromoManager promos={promos as any} />
    </div>
  )
}
