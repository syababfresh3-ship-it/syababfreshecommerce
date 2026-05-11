export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { LpClient } from './lp-client'

export default async function LandingPagesPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('landing_pages')
    .select('id, slug, title, is_active, created_at, updated_at, view_count, meta_pixel_id, google_tag_id, landing_page_leads(count)')
    .order('created_at', { ascending: false })

  return <LpClient initial={data ?? []} />
}
