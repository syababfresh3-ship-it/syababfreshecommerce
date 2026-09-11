import { requireAdmin } from '@/lib/supabase/require-admin'
import { revalidateStorefront } from '@/lib/revalidate-store'
import { isMissingColumnError } from '@/lib/promo-rules'
import { NextResponse } from 'next/server'

const BANNER_FIELDS = [
  'title', 'subtitle', 'image_url', 'link_url', 'is_active',
  'sort_order', 'bg_color', 'text_color', 'badge_text',
  // Sprint 3H: jadual paparan banner (migration 131)
  'starts_at', 'ends_at',
] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const body = await request.json()
  const update: Record<string, unknown> = {}
  for (const key of BANNER_FIELDS) {
    if (key in body) update[key] = body[key]
  }

  const { error } = await supabase!.from('banners').update(update).eq('id', id)
  if (error) {
    // Kolum jadual belum wujud → mesej jelas, bukan ralat mentah.
    if (isMissingColumnError(error)) {
      return NextResponse.json({ error: 'Jalankan migration 131 dulu' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateStorefront()
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const { error } = await supabase!.from('banners').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateStorefront()
  return NextResponse.json({ ok: true })
}
