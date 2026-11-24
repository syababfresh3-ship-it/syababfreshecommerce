import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFICE_ROSTER, readAgentStatuses, type AgentState } from '@/lib/office'
import { gatewayListSessions } from '@/lib/wa-gateway'

// GET /api/admin/office — data Pejabat AI (/admin/pejabat): keadaan setiap staf AI (jadual ai_agent_status +
// keadaan terbitan: Aina dari support_messages, Nurul dari cron_heartbeats), barisan pelanggan belum dibalas,
// kelulusan tertunggak, tugasan berjadual, talian WhatsApp gateway. Admin sahaja. Dibaca setiap 15 saat oleh klien.
export const dynamic = 'force-dynamic'

export interface OfficeAgent {
  key: string; name: string; role: string; where: string
  state: AgentState; task: string | null; since: string | null; lastSeen: string | null; note: string | null
}

const WORKING_WINDOW_MS = 90_000
const PENDING_REPLY_MS = 3 * 60_000
const STALE_REPORT_MS = 30 * 60_000 // laporan 'working' lebih lama dari ini dianggap tamat

export async function GET() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = Date.now()
  const [statuses, lastAssistant, lastUser, openChats, queueRows, queueCount, codStore, codLp, wdPending, appPending, refundsOpen, heartbeats, lines] = await Promise.all([
    readAgentStatuses(admin),
    admin.from('support_messages').select('created_at').eq('role', 'assistant').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('support_messages').select('created_at').eq('role', 'user').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('support_complaints').select('id', { count: 'exact', head: true }).in('status', ['open', 'escalated']),
    admin.from('wa_conversations').select('last_message_preview, last_message_at, unread_count, wa_contacts(name, wa_id)').eq('needs_reply', true).order('last_message_at', { ascending: false }).limit(8),
    admin.from('wa_conversations').select('id', { count: 'exact', head: true }).eq('needs_reply', true),
    admin.from('orders').select('id', { count: 'exact', head: true }).eq('needs_approval', true).eq('status', 'pending'),
    admin.from('lp_guest_orders').select('id', { count: 'exact', head: true }).eq('needs_approval', true).eq('status', 'pending'),
    admin.from('affiliate_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('affiliate_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('refunds').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']),
    admin.from('cron_heartbeats').select('job, last_ok_at, expected_minutes, last_error, last_error_at').order('job'),
    gatewayListSessions().catch(() => ({ ok: false, sessions: [] as { session_id: string; status: string; phone_number?: string | null; device_name?: string | null; sent_today?: number }[] })),
  ])

  const byKey = new Map(statuses.rows.map(r => [r.agent_key, r]))
  const t = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0)

  // ── Aina (terbitan dari chat bantuan) ──
  const aAt = t(lastAssistant.data?.created_at), uAt = t(lastUser.data?.created_at)
  const ainaWorking = (uAt > aAt && now - uAt < PENDING_REPLY_MS) || (aAt && now - aAt < WORKING_WINDOW_MS)
  const openN = openChats.count ?? 0

  // ── Nurul (laporan & amaran) ──
  type Hb = { job: string; last_ok_at: string | null; expected_minutes: number; last_error: string | null; last_error_at: string | null }
  const hbs = ((heartbeats.data ?? []) as Hb[]).map(h => ({
    job: h.job, lastOkAt: h.last_ok_at, expectedMinutes: h.expected_minutes, lastError: h.last_error, lastErrorAt: h.last_error_at,
    stale: !h.last_ok_at || now - t(h.last_ok_at) > h.expected_minutes * 3 * 60_000,
  }))
  const staleJobs = hbs.filter(h => h.stale).map(h => h.job)
  const lastRun = [...hbs].filter(h => h.lastOkAt).sort((a, b) => t(b.lastOkAt) - t(a.lastOkAt))[0]

  const agents: OfficeAgent[] = OFFICE_ROSTER.map(r => {
    const row = byKey.get(r.key)
    const fresh = row ? now - t(row.last_seen) < STALE_REPORT_MS : false
    let state: AgentState = 'offline', task: string | null = null, note: string | null = null
    if (row && (fresh || row.state !== 'working')) { state = row.state; task = row.task }
    else if (row) { state = 'idle'; task = row.task; note = 'Laporan terakhir lebih 30 minit, dianggap tamat' }

    if (r.key === 'aina') {
      state = ainaWorking ? 'working' : 'idle'
      task = ainaWorking ? 'Membalas pelanggan di chat bantuan' : null
      note = `${openN} chat terbuka`
      return { ...r, state, task, since: null, lastSeen: lastAssistant.data?.created_at ?? null, note }
    }
    if (r.key === 'nurul') {
      if (!(row && fresh && row.state === 'working')) {
        if (staleJobs.length) { state = 'waiting'; task = `Cron senyap: ${staleJobs.join(', ')}` }
        else { state = 'idle'; task = row?.task ?? null }
      }
      note = lastRun ? `Larian terakhir: ${lastRun.job}` : null
      return { ...r, state, task, since: row?.since ?? null, lastSeen: lastRun?.lastOkAt ?? row?.last_seen ?? null, note }
    }
    if (!row) note = 'Belum lapor diri (buka sesi Claude Code dalam folder ini)'
    return { ...r, state, task, since: row?.since ?? null, lastSeen: row?.last_seen ?? null, note }
  })
  // Agen lain yang lapor diri tapi tiada dalam roster
  for (const row of statuses.rows) {
    if (OFFICE_ROSTER.some(r => r.key === row.agent_key)) continue
    const fresh = now - t(row.last_seen) < STALE_REPORT_MS
    agents.push({ key: row.agent_key, name: row.name || row.agent_key, role: row.role || 'Agen', where: String(row.meta?.where ?? 'Luar'), state: fresh || row.state !== 'working' ? row.state : 'idle', task: row.task, since: row.since, lastSeen: row.last_seen, note: null })
  }

  type QRow = { last_message_preview: string | null; last_message_at: string | null; unread_count: number | null; wa_contacts: { name: string | null; wa_id: string } | { name: string | null; wa_id: string }[] | null }
  const queue = ((queueRows.data ?? []) as QRow[]).map(q => {
    const c = Array.isArray(q.wa_contacts) ? q.wa_contacts[0] : q.wa_contacts
    return { name: c?.name || c?.wa_id || 'Pelanggan', waId: c?.wa_id ?? '', preview: q.last_message_preview ?? '', at: q.last_message_at, unread: q.unread_count ?? 0 }
  })

  const approvals = [
    { key: 'cod_store', label: 'COD pesanan pertama ahli', count: codStore.count ?? 0, href: '/admin/orders' },
    { key: 'cod_lp', label: 'COD landing page', count: codLp.count ?? 0, href: '/admin/fulfillment' },
    { key: 'withdrawals', label: 'Pengeluaran affiliate', count: wdPending.count ?? 0, href: '/admin/affiliates' },
    { key: 'applications', label: 'Permohonan affiliate', count: appPending.count ?? 0, href: '/admin/affiliates' },
    { key: 'refunds', label: 'Refund belum selesai', count: refundsOpen.count ?? 0, href: '/admin/refunds' },
  ]

  const sessions = (lines.sessions ?? []).filter(s => s.status === 'connected' || s.status === 'disconnected').map(s => ({
    name: s.device_name || s.session_id, phone: s.phone_number ?? null, status: s.status, sentToday: s.sent_today ?? 0,
  }))

  return NextResponse.json({
    now: new Date(now).toISOString(),
    tableMissing: statuses.tableMissing,
    agents,
    queue: { count: queueCount.count ?? 0, items: queue },
    approvals,
    crons: hbs,
    lines: { ok: lines.ok !== false, sessions },
  })
}
