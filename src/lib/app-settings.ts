import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// Cache semua app_settings — revalidate setiap 5 minit atau bila admin update
export const getAppSettings = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const supabase = createAdminClient()
    const { data } = await supabase.from('app_settings').select('key, value')
    const map: Record<string, string> = {}
    for (const row of data ?? []) map[row.key] = row.value
    return map
  },
  ['app-settings-all'],
  { revalidate: 300, tags: ['app-settings'] }
)

// Saluran WhatsApp untuk notifikasi tracking ke pelanggan.
//  'murpati' (default) → auto-hantar via gateway Murpati (tingkah laku asal)
//  'off'               → JANGAN hantar WA (email + push kekal); guna ReplyLa blast
// Diset di /admin/settings/whatsapp. Berguna bila no Murpati kena ban → tukar 'off'.
export type WaCustomerTracking = 'murpati' | 'off'
export async function getWaCustomerTracking(): Promise<WaCustomerTracking> {
  const s = await getAppSettings()
  return s['wa_customer_tracking'] === 'off' ? 'off' : 'murpati'
}
