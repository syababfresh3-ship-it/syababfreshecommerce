import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { POS_SETTINGS_KEY, parsePosSettings, normalizePosSettings } from '@/lib/pos/settings'

// Tetapan POS (admin /admin/pos/settings) — satu kunci app_settings `pos_settings` (JSON).
// Corak sama dengan /api/admin/settings/borong. app_settings boleh dibaca umum → tiada rahsia.
export const dynamic = 'force-dynamic'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data } = await supabase!.from('app_settings').select('value').eq('key', POS_SETTINGS_KEY).maybeSingle()
  return NextResponse.json({ settings: parsePosSettings(data?.value ?? null), exists: !!data })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => ({}))
  if (!body?.settings || typeof body.settings !== 'object') return NextResponse.json({ error: 'settings is required' }, { status: 400 })
  const settings = normalizePosSettings(body.settings)
  const { error } = await supabase!.from('app_settings').upsert({ key: POS_SETTINGS_KEY, value: JSON.stringify(settings) }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateTag('app-settings', 'default')
  return NextResponse.json({ ok: true, settings })
}
