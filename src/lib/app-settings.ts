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
