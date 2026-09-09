import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/supabase/require-admin'

// ============================================================
// api/admin/landing-pages/comments — moderasi komen penonton LP live.
// GET  ?page_id=&status=   senarai (terbaru dahulu, max 300)
// PATCH { id, status }     'approved' | 'hidden' | 'pending' → bust cache LP
// DELETE ?id=              padam kekal
// ============================================================

const STATUSES = new Set(['pending', 'approved', 'hidden'])

export async function GET(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const pageId = req.nextUrl.searchParams.get('page_id')
  const status = req.nextUrl.searchParams.get('status')
  let q = supabase!
    .from('lp_live_comments')
    .select('id, page_id, name, message, phone, status, created_at, landing_pages(title, slug)')
    .order('created_at', { ascending: false })
    .limit(300)
  if (pageId) q = q.eq('page_id', pageId)
  if (status && STATUSES.has(status)) q = q.eq('status', status)

  const { data, error } = await q
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return NextResponse.json({ error: 'Jalankan migration 121 (supabase/121_lp_live_comments.sql) dulu' }, { status: 500 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ comments: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const status = typeof body.status === 'string' ? body.status : ''
  if (!id || !STATUSES.has(status)) return NextResponse.json({ error: 'id/status tidak sah' }, { status: 400 })

  const { data, error } = await supabase!
    .from('lp_live_comments')
    .update({ status })
    .eq('id', id)
    .select('id, landing_pages(slug)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Komen yang diluluskan muncul di page selepas cache LP dibersihkan
  const slug = (data as { landing_pages?: { slug?: string } | null } | null)?.landing_pages?.slug
  if (slug) revalidateTag(`lp-${slug}`, 'default')
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const id = (req.nextUrl.searchParams.get('id') ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })

  const { data, error } = await supabase!.from('lp_live_comments').delete().eq('id', id).select('id, landing_pages(slug)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const slug = (data as { landing_pages?: { slug?: string } | null } | null)?.landing_pages?.slug
  if (slug) revalidateTag(`lp-${slug}`, 'default')
  return NextResponse.json({ ok: true })
}
