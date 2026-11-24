'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ClipboardCheck, Clock, Inbox, Loader2, Moon, Phone, RefreshCw, Users } from 'lucide-react'

// Klien Pejabat AI — baca /api/admin/office setiap 15 saat (hanya bila tab kelihatan) dan lukis
// pejabat: satu meja satu staf, lencana Bekerja / Tidur / Menunggu OK / Luar talian. Monokrom.

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
const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis']

function ago(iso: string | null | undefined, now: number): string {
  if (!iso) return '-'
  const d = now - new Date(iso).getTime()
  if (d < 45_000) return 'baru tadi'
  if (d < 3600_000) return `${Math.round(d / 60_000)} min lalu`
  if (d < 86_400_000) return `${Math.round(d / 3600_000)} jam lalu`
  const dt = new Date(new Date(iso).getTime() + 8 * 3600_000)
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`
}

const STATE_LABEL: Record<AgentState, string> = { working: 'Bekerja', idle: 'Tidur', waiting: 'Menunggu OK', offline: 'Luar talian' }

function Badge({ state }: { state: AgentState }) {
  const cls = state === 'working' ? 'bg-gray-900 text-white border-gray-900'
    : state === 'waiting' ? 'bg-white text-gray-900 border-gray-900'
    : state === 'idle' ? 'bg-gray-100 text-gray-600 border-gray-200'
    : 'bg-white text-gray-400 border-dashed border-gray-300'
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-bold border ${cls}`}>
      {state === 'working' && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-white/70 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-white" /></span>}
      {state === 'waiting' && <AlertCircle className="h-3 w-3" />}
      {state === 'idle' && <Moon className="h-3 w-3" />}
      {STATE_LABEL[state]}
    </span>
  )
}

/** Meja isometrik ringkas + orang; warna ikut keadaan. */
function Desk({ state }: { state: AgentState }) {
  const person = state === 'working' ? '#111827' : state === 'waiting' ? '#ffffff' : state === 'idle' ? '#9ca3af' : '#e5e7eb'
  const personStroke = state === 'waiting' ? '#111827' : state === 'offline' ? '#d1d5db' : person
  const deskTop = state === 'offline' ? '#f9fafb' : '#ffffff'
  const dash = state === 'offline' ? '4 3' : undefined
  return (
    <svg viewBox="0 0 140 110" className="w-[140px] h-[110px] shrink-0" aria-hidden="true">
      <ellipse cx="70" cy="98" rx="52" ry="7" fill="#f3f4f6" />
      {/* orang (di belakang meja) */}
      <circle cx="70" cy="30" r="10" fill={person} stroke={personStroke} strokeWidth="1.5" />
      <path d="M52 62 C52 46 88 46 88 62 L88 66 L52 66 Z" fill={person} stroke={personStroke} strokeWidth="1.5" />
      {/* meja: muka hadapan & sisi */}
      <polygon points="22,62 70,86 70,96 22,72" fill="#e5e7eb" stroke="#d1d5db" strokeDasharray={dash} />
      <polygon points="70,86 118,62 118,72 70,96" fill="#d1d5db" stroke="#9ca3af" strokeDasharray={dash} />
      {/* meja: permukaan */}
      <polygon points="22,62 70,38 118,62 70,86" fill={deskTop} stroke="#9ca3af" strokeWidth="1.2" strokeDasharray={dash} />
      {/* monitor */}
      <polygon points="58,52 80,41 80,56 58,67" fill="#ffffff" stroke="#111827" strokeWidth="1.2" />
      <polygon points="61,53 77,45 77,54 61,62" fill={state === 'working' ? '#111827' : '#f3f4f6'} />
      <line x1="69" y1="62" x2="69" y2="70" stroke="#111827" strokeWidth="1.2" />
      {/* cawan */}
      <ellipse cx="96" cy="66" rx="4" ry="2.2" fill="#ffffff" stroke="#9ca3af" />
      {state === 'idle' && <text x="88" y="24" fontSize="10" fontWeight="700" fill="#9ca3af" fontFamily="ui-sans-serif, system-ui">zz</text>}
      {state === 'waiting' && <circle cx="88" cy="20" r="6" fill="#111827" />}
      {state === 'waiting' && <text x="88" y="23.5" fontSize="9" fontWeight="800" fill="#ffffff" textAnchor="middle" fontFamily="ui-sans-serif, system-ui">!</text>}
    </svg>
  )
}

function DeskCard({ a, now }: { a: Agent; now: number }) {
  const dim = a.state === 'offline'
  return (
    <div className={`rounded-2xl border bg-white p-3 flex gap-2 ${a.state === 'working' ? 'border-gray-900 shadow-sm' : 'border-gray-200'} ${dim ? 'opacity-70' : ''}`}>
      <Desk state={a.state} />
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold text-gray-900 leading-tight truncate">{a.name}</p>
            <p className="text-[12px] text-gray-500 truncate">{a.role} · {a.where}</p>
          </div>
          <Badge state={a.state} />
        </div>
        <p className={`text-[13px] mt-2 leading-snug line-clamp-2 ${a.task ? 'text-gray-800' : 'text-gray-400'}`}>{a.task ?? (a.state === 'offline' ? 'Tiada isyarat' : 'Tiada tugasan sekarang')}</p>
        <div className="mt-auto pt-2 flex items-center justify-between gap-2 text-[11px] text-gray-400">
          <span className="truncate">{a.note ?? ''}</span>
          <span className="shrink-0 inline-flex items-center gap-1"><Clock className="h-3 w-3" />{ago(a.lastSeen, now)}</span>
        </div>
      </div>
    </div>
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
  const crons = data ? [...data.crons].sort((a, b) => Number(b.stale) - Number(a.stale) || a.job.localeCompare(b.job)) : []
  const cronsShown = allCrons ? crons : crons.slice(0, 8)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 inline-flex items-center gap-2"><Users className="h-5 w-5 text-gray-500" />Pejabat AI</h1>
          <p className="text-sm text-gray-500 mt-0.5">Siapa tengah buat apa. Segar setiap 15 saat{fetchedAt ? ` · dikemas kini ${ago(new Date(fetchedAt).toISOString(), now)}` : ''}.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-gray-600"><b className="text-gray-900">{working}</b> bekerja · <b className="text-gray-900">{waiting}</b> menunggu OK</span>
          <button type="button" onClick={() => load()} disabled={busy}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 bg-white text-[13px] font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Segar
          </button>
        </div>
      </div>

      {err && <div className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">Gagal muat: {err}</div>}
      {data?.tableMissing && (
        <div className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          Jadual <code className="font-mono">ai_agent_status</code> belum wujud (migration 168). Aina dan Nurul tetap dipapar dari data sedia ada; agen Hermes dan Claude Code hanya boleh lapor diri selepas migration dijalankan.
        </div>
      )}

      {!data && !err ? (
        <p className="text-sm text-gray-400 inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Memuatkan pejabat…</p>
      ) : data && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
          {/* Lantai pejabat */}
          <div className="rounded-3xl border border-gray-200 p-3 md:p-4" style={{ backgroundColor: '#fafafa', backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
              {data.agents.map(a => <DeskCard key={a.key} a={a} now={now} />)}
            </div>
          </div>

          {/* Panel sisi */}
          <div className="space-y-4">
            <Panel icon={<Inbox className="h-4 w-4 text-gray-500" />} title="Barisan pelanggan" right={<Link href="/admin/crm/inbox" className="text-[12px] font-semibold text-gray-600 hover:text-gray-900">Inbox</Link>}>
              <p className="text-[12px] text-gray-500 mb-2">{data.queue.count} perbualan belum dibalas</p>
              {data.queue.items.length === 0 ? <p className="text-[13px] text-gray-400">Tiada yang menunggu.</p> : (
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

            <Panel icon={<ClipboardCheck className="h-4 w-4 text-gray-500" />} title="Menunggu kelulusan awak" right={<span className={`text-[12px] font-bold ${approvalsTotal ? 'text-gray-900' : 'text-gray-400'}`}>{approvalsTotal}</span>}>
              <ul className="divide-y divide-gray-100">
                {data.approvals.map(a => (
                  <li key={a.key} className="py-2 flex items-center justify-between gap-2">
                    <Link href={a.href} className="text-[13px] text-gray-800 hover:text-gray-900 hover:underline">{a.label}</Link>
                    <span className={`min-w-6 text-center text-[12px] font-bold rounded-full px-1.5 py-0.5 ${a.count ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>{a.count}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={<Clock className="h-4 w-4 text-gray-500" />} title="Tugasan berjadual" right={crons.length > 8 && <button type="button" onClick={() => setAllCrons(v => !v)} className="text-[12px] font-semibold text-gray-600 hover:text-gray-900">{allCrons ? 'Ringkas' : `Semua (${crons.length})`}</button>}>
              <ul className="divide-y divide-gray-100">
                {cronsShown.map(c => (
                  <li key={c.job} className="py-1.5 flex items-center justify-between gap-2">
                    <span className={`text-[13px] truncate ${c.stale ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{c.stale && <AlertCircle className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}{c.job}</span>
                    <span className="shrink-0 text-[11px] text-gray-400">{c.stale ? 'senyap · ' : ''}{ago(c.lastOkAt, now)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={<Phone className="h-4 w-4 text-gray-500" />} title="Talian WhatsApp">
              {!data.lines.ok ? <p className="text-[13px] text-gray-400">Gateway tidak dapat dihubungi.</p> : data.lines.sessions.length === 0 ? <p className="text-[13px] text-gray-400">Tiada nombor.</p> : (
                <ul className="divide-y divide-gray-100">
                  {data.lines.sessions.map(s => (
                    <li key={s.name + (s.phone ?? '')} className="py-1.5 flex items-center justify-between gap-2 text-[13px]">
                      <span className="text-gray-800 truncate">{s.name}{s.phone ? <span className="text-gray-400"> · {s.phone}</span> : ''}</span>
                      <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-gray-500"><span className={`h-2 w-2 rounded-full ${s.status === 'connected' ? 'bg-gray-900' : 'bg-gray-300'}`} />{s.status === 'connected' ? `${s.sentToday} hari ini` : 'putus'}</span>
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
