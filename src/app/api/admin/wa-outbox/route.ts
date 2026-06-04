import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Pantau & urus baris gilir WhatsApp (wa_outbox). RLS = service-role sahaja,
// jadi client browser tak boleh baca terus — semua lalu di sini (admin-protected).

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return !!profile?.is_admin
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // pending|sent|failed|null(=semua)
  const now = new Date().toISOString()

  // Kiraan ringkas (head, tak tarik baris)
  const headCount = (s: string) =>
    admin.from('wa_outbox').select('id', { count: 'exact', head: true }).eq('status', s)
  const [pending, sent, failed, due] = await Promise.all([
    headCount('pending'),
    headCount('sent'),
    headCount('failed'),
    admin.from('wa_outbox').select('id', { count: 'exact', head: true }).eq('status', 'pending').lte('scheduled_at', now),
  ])

  let q = admin
    .from('wa_outbox')
    .select('id, phone, source, status, scheduled_at, attempts, last_error, session_id, sent_at, created_at')
    .order('created_at', { ascending: false })
    .limit(150)
  if (status) q = q.eq('status', status)
  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    counts: {
      pending: pending.count ?? 0,
      sent: sent.count ?? 0,
      failed: failed.count ?? 0,
      due: due.count ?? 0,
    },
    rows: rows ?? [],
  })
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { action, id }: { action?: string; id?: string } = await req.json().catch(() => ({}))
  const reset = { status: 'pending', attempts: 0, last_error: null, scheduled_at: new Date().toISOString() }

  if (action === 'retry' && id) {
    const { error } = await admin.from('wa_outbox').update(reset).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'retry_failed') {
    const { error, count } = await admin
      .from('wa_outbox')
      .update(reset, { count: 'exact' })
      .eq('status', 'failed')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, retried: count ?? 0 })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
