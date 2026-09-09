import { requireAdmin } from '@/lib/supabase/require-admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizeLiveConfig, validateLiveConfig } from '@/lib/lp-live'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const BASE = 'id, slug, title, is_active, created_at, updated_at, view_count, meta_pixel_id, google_tag_id'
  const list = (select: string) =>
    supabase!.from('landing_pages').select(select).order('created_at', { ascending: false })

  let res: { data: unknown; error: { code?: string; message: string } | null } =
    await list(`${BASE}, template, landing_page_leads(count)`)

  // 42703 = lajur `template` belum wujud (migration 120 belum dijalankan) → senarai tanpa template
  if (res.error?.code === '42703') res = await list(`${BASE}, landing_page_leads(count)`)

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  return NextResponse.json(res.data)
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()

  const body = await request.json()
  const { title, slug, html_content, is_active } = body

  if (!title || typeof title !== 'string' || title.trim().length < 2)
    return NextResponse.json({ error: 'Tajuk tidak sah' }, { status: 400 })
  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug.trim()))
    return NextResponse.json({ error: 'Slug tidak sah (huruf kecil, angka, tanda - sahaja)' }, { status: 400 })
  if (typeof html_content !== 'string')
    return NextResponse.json({ error: 'HTML tidak sah' }, { status: 400 })

  const { meta_pixel_id, google_tag_id } = body
  const insertData: Record<string, unknown> = {
    title: title.trim(),
    slug: slug.trim(),
    html_content,
    is_active: is_active ?? true,
    created_by: user?.id ?? null,
  }
  if (meta_pixel_id !== undefined) insertData.meta_pixel_id = meta_pixel_id || null
  if (google_tag_id !== undefined) insertData.google_tag_id = google_tag_id || null

  // Template 'live' (gaya TikTok, kandungan sebenar) — migration 120
  const { template, live_config } = body
  if (template !== undefined) {
    if (template !== 'classic' && template !== 'live')
      return NextResponse.json({ error: 'Template tidak sah' }, { status: 400 })
    insertData.template = template
  }
  if (template === 'live') {
    const cfg = normalizeLiveConfig(live_config)
    const err = validateLiveConfig(cfg)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    insertData.live_config = cfg
  } else if (live_config !== undefined) {
    insertData.live_config = live_config ? normalizeLiveConfig(live_config) : null
  }

  const { data, error } = await supabase!.from('landing_pages').insert(insertData).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug sudah digunakan' }, { status: 409 })
    if (error.code === '42703') return NextResponse.json({ error: 'Jalankan migration 120 (supabase/120_lp_live_template.sql) dulu' }, { status: 500 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
