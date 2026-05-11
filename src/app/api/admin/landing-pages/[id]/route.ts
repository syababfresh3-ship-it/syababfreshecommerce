import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

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

  const { error } = await supabase!.from('landing_pages').update(update).eq('id', id)
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug sudah digunakan' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const { error } = await supabase!.from('landing_pages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
