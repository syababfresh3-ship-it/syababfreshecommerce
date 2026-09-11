import { requireAdmin } from '@/lib/supabase/require-admin'
import { sanitizePaymentMethodIds } from '@/lib/lp-payment'
import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { normalizeLiveConfig, validateLiveConfig } from '@/lib/lp-live'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const { data, error } = await supabase!
    .from('landing_pages')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('title' in body) {
    if (!body.title || typeof body.title !== 'string' || body.title.trim().length < 2)
      return NextResponse.json({ error: 'Tajuk tidak sah' }, { status: 400 })
    update.title = body.title.trim()
  }
  if ('slug' in body) {
    if (!body.slug || typeof body.slug !== 'string' || !/^[a-z0-9-]+$/.test(body.slug.trim()))
      return NextResponse.json({ error: 'Slug tidak sah' }, { status: 400 })
    update.slug = body.slug.trim()
  }
  if ('html_content' in body) update.html_content = body.html_content
  if ('is_active' in body) update.is_active = Boolean(body.is_active)
  if ('meta_pixel_id' in body) update.meta_pixel_id = body.meta_pixel_id || null
  if ('google_tag_id' in body) update.google_tag_id = body.google_tag_id || null

  // Template 'live' — migration 120
  if ('template' in body) {
    if (body.template !== 'classic' && body.template !== 'live')
      return NextResponse.json({ error: 'Template tidak sah' }, { status: 400 })
    update.template = body.template
  }
  if (body.template === 'live' || 'live_config' in body) {
    const cfg = normalizeLiveConfig(body.live_config)
    if (body.template === 'live') {
      const err = validateLiveConfig(cfg)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }
    update.live_config = body.live_config ? cfg : null
  }

  // Kaedah bayaran khas untuk LP ini (migration 132). Kosong/null = ikut sejagat.
  if ('payment_methods' in body) {
    update.payment_methods = await sanitizePaymentMethodIds(supabase!, body.payment_methods)
  }

  const { data, error } = await supabase!.from('landing_pages').update(update).eq('id', id).select('slug').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug sudah digunakan' }, { status: 409 })
    if (error.code === '42703' || error.code === 'PGRST204') return NextResponse.json({ error: 'Kolum belum wujud — jalankan migration 120 / 132 dulu' }, { status: 500 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Bust cache LP supaya edit terus nampak (cache 60s tak perlu ditunggu)
  if (data?.slug) revalidateTag(`lp-${data.slug}`, 'default')
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const { data, error } = await supabase!.from('landing_pages').delete().eq('id', id).select('slug').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.slug) revalidateTag(`lp-${data.slug}`, 'default')
  return NextResponse.json({ ok: true })
}
