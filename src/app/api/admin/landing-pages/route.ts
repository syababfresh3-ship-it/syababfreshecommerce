import { requireAdmin } from '@/lib/supabase/require-admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data, error } = await supabase!
    .from('landing_pages')
    .select('id, slug, title, is_active, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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

  const { data, error } = await supabase!.from('landing_pages').insert({
    title: title.trim(),
    slug: slug.trim(),
    html_content,
    is_active: is_active ?? true,
    created_by: user?.id ?? null,
  }).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug sudah digunakan' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
