import { createClient } from '@/lib/supabase/server'
import { MobileHeader } from './mobile-header'

async function getLogoUrl(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'store_logo_url')
      .maybeSingle()
    return data?.value || null
  } catch {
    return null
  }
}

export async function LogoHeader() {
  const logoUrl = await getLogoUrl()
  return <MobileHeader logoUrl={logoUrl} />
}
