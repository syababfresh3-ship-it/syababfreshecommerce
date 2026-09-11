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

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data } = await supabase!.from('banners').select('*').order('sort_order')
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const insert: Record<string, unknown> = {}
  for (const key of BANNER_FIELDS) {
    if (key in body) insert[key] = body[key]
  }

  const { error, data } = await supabase!.from('banners').insert(insert).select().single()
  if (error) {
    // Kolum jadual belum wujud → mesej jelas, bukan ralat mentah.
    if (isMissingColumnError(error)) {
      return NextResponse.json({ error: 'Jalankan migration 131 dulu' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateStorefront()
  return NextResponse.json(data)
}
