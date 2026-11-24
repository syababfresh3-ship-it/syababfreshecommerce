'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ClipboardCheck, Clock, Inbox, Loader2, Moon, Phone, RefreshCw, Users } from 'lucide-react'

// AI Office client — polls /api/admin/office every 15 s (only while the tab is visible) and draws an
// isometric office: one desk per AI worker, a customer queue at the entrance, side panels for approvals,
// scheduled jobs and WhatsApp lines. Light, soft palette; state colours carry meaning (green working,
// amber waiting for OK, grey idle, dashed offline).

type AgentState = 'working' | 'idle' | 'waiting' | 'offline'
interface Agent { key: string; name: string; role: string; where: string; state: AgentState; task: string | null; since: string | null; lastSeen: string | null; note: string | null }
interface Office {
  now: string
  tableMissing: boolean
  agents: Agent[]
  queue: { count: number; items: { name: string; waId: string; preview: string; at: string | null; unread: number }[] }
  approvals: { key: string; label: string; count: number; href: string }[]
  crons: { job: string; lastOkAt: string | null; expectedMinutes: number; lastError: string | null; stale: boolean }[]
  lines: { ok: boolean; sessions: { name: string; phone: string | null; status: string; sentToday: number }[] }
}

const POLL_MS = 15_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return '-'
  const d = now - new Date(iso).getTime()
  if (d < 45_000) return 'just now'
  if (d < 3600_000) return `${Math.round(d / 60_000)} min ago`
  if (d < 86_400_000) return `${Math.round(d / 3600_000)} h ago`
  const dt = new Date(new Date(iso).getTime() + 8 * 3600_000)
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`
}

const STATE_LABEL: Record<AgentState, string> = { working: 'Working', idle: 'Idle', waiting: 'Waiting for OK', offline: 'Offline' }
const STATE_COLOR: Record<AgentState, { body: string; screen: string; pill: string; pillText: string }> = {
  working: { body: '#16a34a', screen: '#86efac', pill: '#16a34a', pillText: '#ffffff' },
  waiting: { body: '#d97706', screen: '#fde68a', pill: '#d97706', pillText: '#ffffff' },
  idle: { body: '#9ca3af', screen: '#e5e7eb', pill: '#e5e7eb', pillText: '#4b5563' },
  offline: { body: '#d1d5db', screen: '#f3f4f6', pill: '#ffffff', pillText: '#9ca3af' },
}

function Badge({ state }: { state: AgentState }) {
  const c = STATE_COLOR[state]
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-bold border ${state === 'offline' ? 'border-dashed border-gray-300' : 'border-transparent'}`} style={{ background: c.pill, color: c.pillText }}>
      {state === 'working' && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-white/70 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-white" /></span>}
      {state === 'waiting' && <AlertCircle className="h-3 w-3" />}
      {state === 'idle' && <Moon className="h-3 w-3" />}
      {STATE_LABEL[state]}
    </span>
  )
}

// ── Isometric scene ────────────────────────────────────────────────────────────
const IX = 0.866, IY = 0.5
const iso = (x: number, y: number, z = 0) => ({ X: (x - y) * IX, Y: (x + y) * IY - z })
const pts = (...p: { X: number; Y: number }[]) => p.map(q => `${q.X.toFixed(1)},${q.Y.toFixed(1)}`).join(' ')

function Box({ x, y, w, d, h, z = 0, top, left, right, stroke = 'none', dash }: { x: number; y: number; w: number; d: number; h: number; z?: number; top: string; left: string; right: string; stroke?: string; dash?: string }) {
  const a = iso(x, y, z + h), b = iso(x + w, y, z + h), c = iso(x + w, y + d, z + h), dd = iso(x, y + d, z + h)
  const l1 = iso(x, y + d, z), l2 = iso(x + w, y + d, z), r1 = iso(x + w, y, z)
  return (
    <g stroke={stroke} strokeWidth="0.8" strokeDasharray={dash}>
      <polygon points={pts(dd, c, l2, l1)} fill={left} />
      <polygon points={pts(b, c, l2, r1)} fill={right} />
      <polygon points={pts(a, b, c, dd)} fill={top} />
    </g>
  )
}

function Plant({ x, y }: { x: number; y: number }) {
  const b = iso(x, y, 0)
  return (
    <g>
      <ellipse cx={b.X} cy={b.Y + 2} rx="9" ry="4" fill="#e7e0d3" />
      <path d={`M${b.X - 7} ${b.Y - 2} h14 l-2 12 h-10 z`} fill="#c08457" />
      <circle cx={b.X - 5} cy={b.Y - 10} r="7" fill="#22c55e" />
      <circle cx={b.X + 5} cy={b.Y - 12} r="8" fill="#16a34a" />
      <circle cx={b.X} cy={b.Y - 18} r="6" fill="#4ade80" />
    </g>
  )
}

function Person({ x, y, z, state, scale = 1, marks = true }: { x: number; y: number; z: number; state: AgentState; scale?: number; marks?: boolean }) {
  const c = STATE_COLOR[state]
  const head = iso(x, y, z + 28 * scale), body = iso(x, y, z)
  const w = 24 * scale, hgt = 26 * scale
  return (
    <g>
      <path d={`M${body.X - w / 2} ${body.Y} v${-hgt + 8} a${w / 2} ${w / 2} 0 0 1 ${w} 0 v${hgt - 8} z`} fill={c.body} stroke={state === 'offline' ? '#cbd5e1' : 'none'} />
      <circle cx={head.X} cy={head.Y} r={9.5 * scale} fill={state === 'offline' ? '#f1f5f9' : '#ffe0c2'} stroke={state === 'offline' ? '#cbd5e1' : '#e8c4a0'} strokeWidth="0.8" />
      {marks && state === 'idle' && <text x={head.X + 10} y={head.Y - 8} fontSize={10 * scale} fontWeight="700" fill="#9ca3af" fontFamily="ui-sans-serif, system-ui">zz</text>}
      {marks && state === 'waiting' && <g><circle cx={head.X + 12} cy={head.Y - 12} r="6.5" fill="#d97706" /><text x={head.X + 12} y={head.Y - 8.5} fontSize="9" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="ui-sans-serif, system-ui">!</text></g>}
    </g>
  )
}

const CELL = 200

function OfficeScene({ agents, queueCount, now }: { agents: Agent[]; queueCount: number; now: number }) {
  const cols = agents.length <= 4 ? 2 : 3
  const rows = Math.max(1, Math.ceil(agents.length / cols))
  const floorW = cols * CELL, floorD = rows * CELL
  // bounding box of floor + margins (left for queue, top for bubbles, bottom for labels)
  const corners = [iso(0, 0), iso(floorW, 0), iso(floorW, floorD), iso(0, floorD)]
  const minX = Math.min(...corners.map(p => p.X)) - 150, maxX = Math.max(...corners.map(p => p.X)) + 40
  const minY = Math.min(...corners.map(p => p.Y)) - 110, maxY = Math.max(...corners.map(p => p.Y)) + 70
  const placed = agents.map((a, i) => ({ a, c: i % cols, r: Math.floor(i / cols) })).sort((p, q) => (p.c + p.r) - (q.c + q.r))
  const tiles: string[] = []
  for (let tx = 0; tx <= floorW; tx += 30) tiles.push(pts(iso(tx, 0), iso(tx, floorD)))
  for (let ty = 0; ty <= floorD; ty += 30) tiles.push(pts(iso(0, ty), iso(floorW, ty)))
  const entrance = iso(-20, floorD * 0.55)
  const queueFigures = Math.min(queueCount, 5)

  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="w-full h-auto" style={{ maxHeight: 720 }} role="img" aria-label="AI office">
      {/* floor slab */}
      <polygon points={pts(iso(0, floorD, 0), iso(floorW, floorD, 0), iso(floorW, floorD, -14), iso(0, floorD, -14))} fill="#e3dccf" />
      <polygon points={pts(iso(floorW, 0, 0), iso(floorW, floorD, 0), iso(floorW, floorD, -14), iso(floorW, 0, -14))} fill="#d6cdbd" />
      <polygon points={pts(...corners)} fill="#f8f5ef" />
      {tiles.map((t, i) => <polyline key={i} points={t} fill="none" stroke="#ebe5da" strokeWidth="0.8" />)}
      {/* entrance mat + queue */}
      <polygon points={pts(iso(-26, floorD * 0.55 - 22), iso(0, floorD * 0.55 - 22), iso(0, floorD * 0.55 + 22), iso(-26, floorD * 0.55 + 22))} fill="#dbe4ee" />
      {Array.from({ length: queueFigures }).map((_, k) => <Person key={k} x={-46 - k * 22} y={floorD * 0.55 + (k % 2 ? 6 : -6)} z={0} state="idle" scale={0.8} marks={false} />)}
      <text x={entrance.X - 70} y={entrance.Y + 40} fontSize="11" fontWeight="700" fill="#475569" textAnchor="middle" fontFamily="ui-sans-serif, system-ui">
        {queueCount === 0 ? 'No customers waiting' : `${queueCount} customer${queueCount === 1 ? '' : 's'} waiting`}
      </text>
      <Plant x={18} y={18} />
      <Plant x={floorW - 18} y={18} />

      {placed.map(({ a, c, r }) => {
        const cx = c * CELL + 25, cy = r * CELL + 20
        const col = STATE_COLOR[a.state]
        const dash = a.state === 'offline' ? '3 2' : undefined
        const head = iso(cx + 75, cy + 30, 60)
        return (
          <g key={a.key} opacity={a.state === 'offline' ? 0.7 : 1}>
            <Box x={cx + 62} y={cy + 18} w={26} d={22} h={14} top="#6b7280" left="#4b5563" right="#374151" />
            <Box x={cx + 62} y={cy + 14} w={26} d={5} h={34} top="#4b5563" left="#374151" right="#1f2937" />
            <Person x={cx + 75} y={cy + 30} z={22} state={a.state} />
            <Box x={cx + 32} y={cy + 46} w={86} d={42} h={30} top="#f1e4d0" left="#d9c6a8" right="#c9b391" stroke="#b59f7c" dash={dash} />
            {/* monitor: skrin menghadap pemerhati (muka kanan) */}
            <Box x={cx + 66} y={cy + 54} w={28} d={3} h={20} z={30} top="#1f2937" left="#111827" right={col.screen} />
            <ellipse cx={iso(cx + 106, cy + 74, 30).X} cy={iso(cx + 106, cy + 74, 30).Y} rx="3.5" ry="2" fill="#fff" stroke="#9ca3af" strokeWidth="0.6" />
            {a.state === 'working' && <circle cx={head.X + 22} cy={head.Y - 22} r="4" fill="#16a34a"><animate attributeName="r" values="3;5;3" dur="1.6s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" /></circle>}
            <title>{`${a.name} · ${STATE_LABEL[a.state]}${a.task ? ` · ${a.task}` : ''} · ${ago(a.lastSeen, now)}`}</title>
          </g>
        )
      })}
      {/* labels & bubbles — laluan akhir supaya tidak ditutup meja hadapan */}
      {placed.map(({ a, c, r }) => {
        const cx = c * CELL + 25, cy = r * CELL + 20
        const head = iso(cx + 75, cy + 30, 60)
        const label = iso(cx + 75, cy + 104, 0)
        return (
          <g key={`${a.key}-label`}>
            {a.task && (a.state === 'working' || a.state === 'waiting') && (
              <foreignObject x={head.X - 92} y={head.Y - 84} width="184" height="58">
                <div className="rounded-xl bg-white border border-gray-200 shadow-sm px-2.5 py-1.5 text-[10.5px] leading-snug text-gray-800 line-clamp-2" style={{ borderColor: a.state === 'waiting' ? '#fcd34d' : '#e5e7eb' }}>{a.task}</div>
              </foreignObject>
            )}
            <text x={label.X} y={label.Y + 8} fontSize="13" fontWeight="800" fill="#111827" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" style={{ paintOrder: 'stroke', stroke: '#f8f5ef', strokeWidth: 3 }}>{a.name}</text>
            <text x={label.X} y={label.Y + 21} fontSize="10" fill="#6b7280" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" style={{ paintOrder: 'stroke', stroke: '#f8f5ef', strokeWidth: 3 }}>{a.role}</text>
            <foreignObject x={label.X - 60} y={label.Y + 26} width="120" height="24">
              <div className="flex justify-center"><Badge state={a.state} /></div>
            </foreignObject>
          </g>
        )
      })}
    </svg>
  )
}

function Panel({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-gray-900 inline-flex items-center gap-2">{icon}{title}</h2>
        {right}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}

export function OfficeClient() {
  const [data, setData] = useState<Office | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number>(0)
  const [now, setNow] = useState<number>(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [allCrons, setAllCrons] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/office', { cache: 'no-store' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      setData(await res.json()); setErr(null); setFetchedAt(Date.now())
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }, [])

  useEffect(() => {
    void load()
    timer.current = setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    const tick = setInterval(() => setNow(Date.now()), 5_000)
    const onVis = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { if (timer.current) clearInterval(timer.current); clearInterval(tick); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  const working = data?.agents.filter(a => a.state === 'working').length ?? 0
  const waiting = data?.agents.filter(a => a.state === 'waiting').length ?? 0
  const approvalsTotal = data?.approvals.reduce((s, a) => s + a.count, 0) ?? 0
  const crons = useMemo(() => (data ? [...data.crons].sort((a, b) => Number(b.stale) - Number(a.stale) || a.job.localeCompare(b.job)) : []), [data])
  const cronsShown = allCrons ? crons : crons.slice(0, 8)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 inline-flex items-center gap-2"><Users className="h-5 w-5 text-gray-500" />AI Office</h1>
          <p className="text-sm text-gray-500 mt-0.5">Who is doing what. Refreshes every 15 seconds{fetchedAt ? ` · updated ${ago(new Date(fetchedAt).toISOString(), now)}` : ''}.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-gray-600"><b className="text-gray-900">{working}</b> working · <b className="text-gray-900">{waiting}</b> waiting for OK</span>
          <button type="button" onClick={() => load()} disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 bg-white text-[13px] font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh
          </button>
        </div>
      </div>

      {err && <div className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">Failed to load: {err}</div>}
      {data?.tableMissing && (
        <div className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          Table <code className="font-mono">ai_agent_status</code> does not exist yet (migration 168). Aina and Nurul still show from existing data; Claude Code teams can only report after the migration runs.
        </div>
      )}

      {!data && !err ? (
        <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading the office…</p>
      ) : data && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <div className="space-y-4 min-w-0">
            {/* Office floor */}
            <div className="rounded-3xl border border-gray-200 p-3 md:p-5 overflow-hidden" style={{ background: 'linear-gradient(180deg, #eef4fb 0%, #f7f9fc 100%)' }}>
              <OfficeScene agents={data.agents} queueCount={data.queue.count} now={now} />
            </div>
            {/* Compact roster (details that do not fit on the floor) */}
            <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
              {data.agents.map(a => (
                <div key={a.key} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: STATE_COLOR[a.state].body }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-gray-900 truncate"><b>{a.name}</b> <span className="text-gray-400">· {a.role} · {a.where}</span></p>
                    <p className="text-[12px] text-gray-600 truncate">{a.task ?? (a.state === 'offline' ? (a.note ?? 'No signal') : 'No task right now')}{a.note && a.task ? <span className="text-gray-400"> · {a.note}</span> : null}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-gray-400 inline-flex items-center gap-1"><Clock className="h-3 w-3" />{ago(a.lastSeen, now)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Panel icon={<Inbox className="h-4 w-4 text-gray-500" />} title="Customer queue" right={<Link href="/admin/crm/inbox" className="text-[12px] font-semibold text-gray-600 hover:text-gray-900">Inbox</Link>}>
              <p className="text-[12px] text-gray-500 mb-2">{data.queue.count} awaiting a reply (last 3 days)</p>
              {data.queue.items.length === 0 ? <p className="text-[13px] text-gray-400">Nobody waiting.</p> : (
                <ul className="divide-y divide-gray-100">
                  {data.queue.items.map((q, i) => (
                    <li key={`${q.waId}-${i}`} className="py-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">{q.name}</p>
                        <p className="text-[12px] text-gray-500 truncate">{q.preview || '(media)'}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-gray-400">{ago(q.at, now)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel icon={<ClipboardCheck className="h-4 w-4 text-gray-500" />} title="Waiting for your approval" right={<span className={`text-[12px] font-bold ${approvalsTotal ? 'text-gray-900' : 'text-gray-400'}`}>{approvalsTotal}</span>}>
              <ul className="divide-y divide-gray-100">
                {data.approvals.map(a => (
                  <li key={a.key} className="py-2 flex items-center justify-between gap-2">
                    <Link href={a.href} className="text-[13px] text-gray-800 hover:text-gray-900 hover:underline">{a.label}</Link>
                    <span className={`min-w-6 text-center text-[12px] font-bold rounded-full px-1.5 py-0.5 ${a.count ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{a.count}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={<Clock className="h-4 w-4 text-gray-500" />} title="Scheduled jobs" right={crons.length > 8 && <button type="button" onClick={() => setAllCrons(v => !v)} className="text-[12px] font-semibold text-gray-600 hover:text-gray-900">{allCrons ? 'Fewer' : `All (${crons.length})`}</button>}>
              <ul className="divide-y divide-gray-100">
                {cronsShown.map(c => (
                  <li key={c.job} className="py-1.5 flex items-center justify-between gap-2">
                    <span className={`text-[13px] truncate ${c.stale ? 'font-bold text-amber-700' : 'text-gray-700'}`}>{c.stale && <AlertCircle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}{c.job}</span>
                    <span className="shrink-0 text-[11px] text-gray-400">{c.stale ? 'silent · ' : ''}{ago(c.lastOkAt, now)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={<Phone className="h-4 w-4 text-gray-500" />} title="WhatsApp lines">
              {!data.lines.ok ? <p className="text-[13px] text-gray-400">Gateway unreachable.</p> : data.lines.sessions.length === 0 ? <p className="text-[13px] text-gray-400">No numbers.</p> : (
                <ul className="divide-y divide-gray-100">
                  {data.lines.sessions.map(s => (
                    <li key={s.name + (s.phone ?? '')} className="py-1.5 flex items-center justify-between gap-2 text-[13px]">
                      <span className="text-gray-800 truncate">{s.name}{s.phone ? <span className="text-gray-400"> · {s.phone}</span> : ''}</span>
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-gray-500"><span className={`h-2 w-2 rounded-full ${s.status === 'connected' ? 'bg-green-600' : 'bg-gray-300'}`} />{s.status === 'connected' ? `${s.sentToday} today` : 'down'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
