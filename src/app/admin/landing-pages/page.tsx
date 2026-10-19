export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { LpClient } from './lp-client'

export default async function LandingPagesPage() {
  const supabase = createAdminClient()
  const BASE = 'id, slug, title, is_active, created_at, updated_at, view_count, meta_pixel_id, google_tag_id, landing_page_leads(count)'
  const list = (select: string) => supabase.from('landing_pages').select(select).order('created_at', { ascending: false })
  // `host` (migration 145) — belum wujud → 42703 → senarai tanpa host (= kedai)
  let res: { data: unknown; error: { code?: string } | null } = await list(`${BASE}, host`)
  if (res.error?.code === '42703') res = await list(BASE)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <LpClient initial={(res.data ?? []) as any} />
}
