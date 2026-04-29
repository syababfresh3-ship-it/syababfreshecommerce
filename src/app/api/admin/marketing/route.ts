import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

const KEYS = ['meta_pixel_id', 'google_ads_id', 'google_ads_label', 'gtm_id', 'flash_sale_label', 'flash_sale_ends_at', 'flash_sale_promo_code'] as const

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data } = await supabase!
    .from('app_settings')
    .select('key, value')
    .in('key', [...KEYS])

  const settings: Record<string, string> = {}
  for (const k of KEYS) settings[k] = ''
  for (const row of data ?? []) settings[row.key] = row.value

  return NextResponse.json(settings)
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()

  for (const key of KEYS) {
    if (key in body) {
      await supabase!
        .from('app_settings')
        .upsert({ key, value: String(body[key] ?? ''), updated_at: new Date().toISOString() })
    }
  }

  return NextResponse.json({ ok: true })
}
