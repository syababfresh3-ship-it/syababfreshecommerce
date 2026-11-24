// ============================================================
// office — "Pejabat AI" (/admin/pejabat): siapa staf AI kita, dan cara mereka lapor status.
// Roster (nama, peranan, di mana ia berjalan) ditakrif di sini; keadaan semasa disimpan dalam
// jadual ai_agent_status (migration 168). Pelapor:
//   - kod pelayan: setAgentStatus(admin, { agent, state, task })  (cron, chatbot)
//   - sesi Claude Code dalam folder Hermes (Mac): hook → Hermes/alat/office-status.mjs → POST /api/office/status (Bearer CRON_SECRET)
// Tolak ralat: jadual belum ada → senyap (dashboard tunjuk "belum lapor diri").
// ============================================================

export type AgentState = 'working' | 'idle' | 'waiting' | 'offline'

export interface RosterEntry {
  key: string
  name: string
  role: string
  where: string
}

/** Staf tetap — susunan = susunan meja di pejabat. Kunci team Hermes = nama folder (hook lapor ikut cwd).
 *  Agen lain yang lapor diri (cth subagen `waba-team--waba-auditor`) ditambah di hujung. */
export const OFFICE_ROSTER: RosterEntry[] = [
  { key: 'hermes', name: 'Hermes', role: 'Pembantu am', where: 'Claude Code · Hermes/' },
  { key: 'amaa-team', name: 'Maya', role: 'Meta Ads', where: 'Claude Code · Hermes/amaa-team' },
  { key: 'waba-team', name: 'Zara', role: 'WhatsApp blast', where: 'Claude Code · Hermes/waba-team' },
  { key: 'lp-team', name: 'Rayyan', role: 'Landing page', where: 'Claude Code · Hermes/lp-team' },
  { key: 'tiktok-team', name: 'Iman', role: 'Analisa video TikTok', where: 'Claude Code · Hermes/tiktok-team' },
  { key: 'aina', name: 'Aina', role: 'Sokongan pelanggan', where: 'Chat bantuan web' },
  { key: 'nurul', name: 'Nurul', role: 'Laporan & amaran', where: 'Routine & cron' },
]

export const AGENT_KEY_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/
export const AGENT_STATES: AgentState[] = ['working', 'idle', 'waiting', 'offline']

export interface AgentStatusRow {
  agent_key: string
  name: string | null
  role: string | null
  state: AgentState
  task: string | null
  since: string | null
  last_seen: string
  meta: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any
const MISSING = new Set(['42P01', 'PGRST205'])

/** Kemas kini keadaan satu agen. Best-effort — tak pernah melontar. */
export async function setAgentStatus(
  sb: SB,
  s: { agent: string; state: AgentState; task?: string | null; name?: string | null; role?: string | null; meta?: Record<string, unknown> },
): Promise<boolean> {
  try {
    if (!AGENT_KEY_RE.test(s.agent) || !AGENT_STATES.includes(s.state)) return false
    const now = new Date().toISOString()
    const { data: prev } = await sb.from('ai_agent_status').select('state, since').eq('agent_key', s.agent).maybeSingle()
    const since = prev && prev.state === s.state && prev.since ? prev.since : now
    const row: Record<string, unknown> = { agent_key: s.agent, state: s.state, task: s.task ? String(s.task).slice(0, 200) : null, since, last_seen: now, updated_at: now }
    if (s.name) row.name = String(s.name).slice(0, 60)
    if (s.role) row.role = String(s.role).slice(0, 80)
    if (s.meta) row.meta = s.meta
    const { error } = await sb.from('ai_agent_status').upsert(row, { onConflict: 'agent_key' })
    if (error && !MISSING.has(error.code ?? '')) console.warn('[office] setAgentStatus:', error.message)
    return !error
  } catch {
    return false
  }
}

/** Jalankan kerja sambil agen ditanda 'working', kemudian 'idle' (walau gagal). */
export async function withAgentStatus<T>(sb: SB, agent: string, task: string, fn: () => Promise<T>): Promise<T> {
  await setAgentStatus(sb, { agent, state: 'working', task })
  try {
    return await fn()
  } finally {
    await setAgentStatus(sb, { agent, state: 'idle', task: `Siap: ${task}`.slice(0, 200) })
  }
}

export async function readAgentStatuses(sb: SB): Promise<{ rows: AgentStatusRow[]; tableMissing: boolean }> {
  const { data, error } = await sb.from('ai_agent_status').select('agent_key, name, role, state, task, since, last_seen, meta')
  if (error) return { rows: [], tableMissing: MISSING.has(error.code ?? '') }
  return { rows: (data ?? []) as AgentStatusRow[], tableMissing: false }
}
