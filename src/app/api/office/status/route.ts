import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setAgentStatus, AGENT_KEY_RE, AGENT_STATES, type AgentState } from '@/lib/office'

// POST /api/office/status — agen luar (skrip Hermes di VPS, hook Claude Code) lapor keadaan semasa
// untuk Pejabat AI (/admin/pejabat). Auth: Authorization: Bearer <CRON_SECRET> (atau OFFICE_STATUS_KEY).
// Body: { agent: 'mira', state: 'working'|'idle'|'waiting'|'offline', task?: 'Eksport ops', name?, role?, meta? }
// Contoh (VPS):  curl -s -X POST https://shop.syababfresh.my/api/office/status \
//   -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
//   -d '{"agent":"mira","state":"working","task":"Eksport laporan ops"}'
export const runtime = 'nodejs'

function authorized(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const ok = [process.env.OFFICE_STATUS_KEY, process.env.CRON_SECRET].filter(Boolean) as string[]
  return !!token && ok.includes(token)
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { agent?: string; state?: string; task?: string; name?: string; role?: string; meta?: Record<string, unknown> } | null
  const agent = String(body?.agent ?? '').trim().toLowerCase()
  const state = String(body?.state ?? '').trim().toLowerCase() as AgentState
  if (!AGENT_KEY_RE.test(agent)) return NextResponse.json({ ok: false, error: 'agent tidak sah (a-z, 0-9, -, _)' }, { status: 400 })
  if (!AGENT_STATES.includes(state)) return NextResponse.json({ ok: false, error: `state mesti salah satu: ${AGENT_STATES.join(', ')}` }, { status: 400 })
  const ok = await setAgentStatus(createAdminClient(), {
    agent, state,
    task: body?.task ?? null, name: body?.name ?? null, role: body?.role ?? null,
    meta: body?.meta && typeof body.meta === 'object' ? body.meta : undefined,
  })
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 })
}
