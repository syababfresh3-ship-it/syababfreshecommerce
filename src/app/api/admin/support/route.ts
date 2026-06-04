import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// Pantau & urus aduan support. GET (senarai + counts, atau ?id= untuk detail+transkrip).
// PATCH untuk tukar status (resolved/closed/rejected).
export async function GET(req: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const { data: complaint } = await supabase!.from('support_complaints').select('*').eq('id', id).maybeSingle()
    if (!complaint) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
    const { data: messages } = await supabase!
      .from('support_messages').select('role, content, created_at')
      .eq('complaint_id', id).order('created_at', { ascending: true })
    return NextResponse.json({ complaint, messages: messages ?? [] })
  }

  const status = searchParams.get('status')
  const headCount = (s: string) =>
    supabase!.from('support_complaints').select('id', { count: 'exact', head: true }).eq('status', s)
  const [open, escalated, resolved] = await Promise.all([headCount('open'), headCount('escalated'), headCount('resolved')])

  let q = supabase!
    .from('support_complaints')
    .select('id, created_at, order_kind, order_number, customer_name, customer_phone, category, status, ai_summary, image_urls, damage_items')
    .order('created_at', { ascending: false })
    .limit(150)
  if (status) q = q.eq('status', status)
  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    counts: { open: open.count ?? 0, escalated: escalated.count ?? 0, resolved: resolved.count ?? 0 },
    rows: rows ?? [],
  })
}

export async function PATCH(req: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { id, status }: { id?: string; status?: string } = await req.json().catch(() => ({}))
  if (!id || !['open', 'escalated', 'resolved', 'closed', 'rejected'].includes(status ?? '')) {
    return NextResponse.json({ error: 'Input tidak sah' }, { status: 400 })
  }
  const { error } = await supabase!
    .from('support_complaints')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
