import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { listSessions, getConfiguredSessionIds } from '@/lib/murpati'

// Status setiap nombor WhatsApp Murpati (connected/disconnected) + tanda mana yg
// dalam send pool (MURPATI_SESSION_IDS). Untuk view admin WA Outbox.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const configured = getConfiguredSessionIds()
  const pool = new Set(configured)
  const result = await listSessions()

  const sessions = result.sessions.map((s) => ({ ...s, in_pool: pool.has(s.session_id) }))
  // Session dlm pool tapi tak muncul dari API (cth dipadam/tak sah) → tanda hilang.
  const known = new Set(sessions.map((s) => s.session_id))
  const missing = configured
    .filter((id) => !known.has(id))
    .map((id) => ({ session_id: id, status: 'not_found', in_pool: true }))

  return NextResponse.json({
    ok: result.ok,
    error: result.error ?? null,
    configuredCount: configured.length,
    sessions: [...sessions, ...missing],
  })
}
