'use client'

// Pipeline Gift Kurma — papan 7 peringkat (+Selesai/Batal) atau senarai; panel deal (fixed, bukan sticky —
// admin-shell overflow-hidden). Auto maju dari sebut harga/invois/bayaran; admin boleh tukar peringkat bebas.
// Bayaran: tanda manual (± rekod juga di Refrens) atau Segerak dari Refrens. Ikon lucide monokrom.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Search, X, LayoutGrid, List, RefreshCw, FileText, ExternalLink, Banknote, Truck, CheckCircle2, AlertTriangle, Save, CalendarDays } from 'lucide-react'
import { rm } from '@/lib/quotation'
import { ACTIVE_STAGES, ALL_STAGES, DELIVERY_METHODS, LOST_REASONS, PAY_METHODS, STAGE_HINT, STAGE_LABEL, balanceDue, dateOnly, depositDue, stageLabel, type DealEvent, type DealRow, type DealStage } from '@/lib/gift-deals'

type Detail = DealRow & { events: DealEvent[] }
interface Summary { count: number; total: number; alerts: number; byStage: Record<string, { count: number; total: number }> }

const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1'
const btnPrimary = 'inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50'
const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50'
const sec = 'rounded-xl border border-gray-200 p-3'
const STAGE_DOT: Record<string, string> = { quote: 'bg-gray-400', invoice: 'bg-blue-500', deposit: 'bg-sky-500', artwork: 'bg-violet-500', production: 'bg-amber-500', delivered: 'bg-teal-500', balance: 'bg-green-500', done: 'bg-green-700', lost: 'bg-gray-300' }
const fmtD = (v: string | null | undefined) => { const d = dateOnly(v); return d ? d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }
const fmtDT = (v: string | null) => v ? new Date(v).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const toDateInput = (v: string | null | undefined) => v ? v.slice(0, 10) : ''
const today = () => new Date().toISOString().slice(0, 10)
const EVENT_LABEL: Record<string, string> = { created: 'Deal dicipta', stage: 'Peringkat', payment: 'Bayaran', delivered: 'Dihantar', artwork: 'Artwork disahkan', edited: 'Diedit', synced: 'Segerak Refrens', accepted: 'Klien terima', note: 'Nota' }
function countdown(needed: string | null): { text: string; cls: string } | null {
  const d = dateOnly(needed); if (!d) return null
  const days = Math.floor((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days < 0) return { text: `Lewat ${-days} hari`, cls: 'text-red-700 bg-red-50 border-red-200' }
  if (days === 0) return { text: 'Hantar hari ini', cls: 'text-red-700 bg-red-50 border-red-200' }
  if (days <= 7) return { text: `${days} hari lagi`, cls: 'text-amber-700 bg-amber-50 border-amber-200' }
  return { text: `${days} hari lagi`, cls: 'text-gray-600 bg-gray-50 border-gray-200' }
}

export function PipelineClient({ initialDealId }: { initialDealId: string | null }) {
  const [deals, setDeals] = useState<DealRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [scope, setScope] = useState('active')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(initialDealId)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState<null | 'deposit' | 'balance'>(null)
  const [pay, setPay] = useState({ amount: '', date: today(), method: 'ACCOUNT_TRANSFER', ref: '', also: true })
  const [confirmPay, setConfirmPay] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const sp = new URLSearchParams({ scope }); if (q.trim().length >= 2) sp.set('q', q.trim())
    const res = await fetch(`/api/admin/gift-deals?${sp}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(j.error ?? 'Gagal muat'); setDeals([]); setSummary(null); setLoading(false); return }
    setDeals(j.deals ?? []); setSummary(j.summary ?? null); setLoading(false)
  }, [scope, q])
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t) }, [load])

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/gift-deals/${id}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(j.error ?? 'Deal tidak dijumpai'); setOpenId(null); return }
    setDetail(j)
    setForm({
      stage: j.stage, title: j.title ?? '', deposit_pct: String(j.deposit_pct ?? 50), po_number: j.po_number ?? '', po_file_url: j.po_file_url ?? '',
      artwork_approved_at: toDateInput(j.artwork_approved_at), artwork_by: j.artwork_by ?? '', artwork_file_url: j.artwork_file_url ?? '',
      production_due: toDateInput(j.production_due), needed_by: toDateInput(j.needed_by),
      delivered_at: toDateInput(j.delivered_at), delivery_method: j.delivery_method ?? '', tracking_no: j.tracking_no ?? '', pod_url: j.pod_url ?? '', received_by: j.received_by ?? '',
      next_action: j.next_action ?? '', next_action_at: toDateInput(j.next_action_at), lost_reason: j.lost_reason ?? '', notes: j.notes ?? '',
    })
  }, [])
  useEffect(() => { if (openId) loadDetail(openId); else setDetail(null) }, [openId, loadDetail])

  const f = (k: string, v: string) => setForm(s => ({ ...s, [k]: v }))
  async function saveDetail(extra: Record<string, unknown> = {}) {
    if (!detail) return
    setBusy('save')
    try {
      const body: Record<string, unknown> = {
        stage: form.stage, title: form.title, deposit_pct: Number(form.deposit_pct), po_number: form.po_number, po_file_url: form.po_file_url,
        artwork_approved_at: form.artwork_approved_at || null, artwork_by: form.artwork_by, artwork_file_url: form.artwork_file_url,
        production_due: form.production_due || null, needed_by: form.needed_by || null,
        delivered_at: form.delivered_at || null, delivery_method: form.delivery_method, tracking_no: form.tracking_no, pod_url: form.pod_url, received_by: form.received_by,
        next_action: form.next_action, next_action_at: form.next_action_at || null, lost_reason: form.lost_reason, notes: form.notes, ...extra,
      }
      if (body.stage === detail.stage) delete body.stage   // biar auto-maju berfungsi bila admin tak ubah peringkat
      const res = await fetch(`/api/admin/gift-deals/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal simpan'); return }
      toast.success('Disimpan'); setDetail(j); await loadDetail(detail.id); await load()
    } finally { setBusy(null) }
  }
  function openPay(kind: 'deposit' | 'balance') {
    if (!detail) return
    const due = kind === 'deposit' ? depositDue(detail) : balanceDue(detail)
    setPay({ amount: due > 0 ? due.toFixed(2) : '', date: today(), method: 'ACCOUNT_TRANSFER', ref: '', also: !!detail.invoice }); setConfirmPay(false); setPayOpen(kind)
  }
  async function submitPay() {
    if (!detail || !payOpen) return
    setBusy('pay')
    try {
      const res = await fetch(`/api/admin/gift-deals/${detail.id}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: payOpen, amount: Number(pay.amount), date: pay.date, method: pay.method, ref: pay.ref, also_refrens: pay.also && !!detail.invoice }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal'); return }
      toast.success(`${payOpen === 'deposit' ? 'Deposit' : 'Baki'} ditanda${j.refrens === 'recorded' ? ' & direkod di Refrens' : j.refrens === 'failed' ? ' (Refrens gagal — rekod manual di Refrens)' : ''}`)
      setPayOpen(null); setDetail(j.deal); await loadDetail(detail.id); await load()
    } finally { setBusy(null); setConfirmPay(false) }
  }
  async function sync() {
    if (!detail) return
    setBusy('sync')
    try {
      const res = await fetch(`/api/admin/gift-deals/${detail.id}/sync`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal segerak'); return }
      toast.success(j.changed ? 'Bayaran dikemas kini dari Refrens' : (j.note ?? 'Tiada perubahan'))
      await loadDetail(detail.id); await load()
    } finally { setBusy(null) }
  }
  const markDelivered = () => { f('delivered_at', form.delivered_at || today()); saveDetail({ delivered_at: form.delivered_at || today() }) }
  const markArtwork = () => { f('artwork_approved_at', form.artwork_approved_at || today()); saveDetail({ artwork_approved_at: form.artwork_approved_at || today() }) }

  const columns = useMemo(() => ACTIVE_STAGES.map(s => ({ stage: s, deals: deals.filter(d => d.stage === s) })), [deals])
  const closed = useMemo(() => deals.filter(d => d.stage === 'done' || d.stage === 'lost'), [deals])

  const card = (d: DealRow) => {
    const cd = countdown(d.needed_by)
    return (
      <button type="button" key={d.id} onClick={() => setOpenId(d.id)} className="w-full text-left rounded-lg border border-gray-200 bg-white p-2 hover:border-gray-400 transition min-w-0">
        <p className="text-[12px] font-semibold text-gray-900 leading-snug line-clamp-2">{d.title ?? d.client.company ?? d.client.name ?? 'Deal'}</p>
        <div className="flex items-center justify-between gap-1 mt-1 min-w-0"><span className="text-[10px] text-gray-500 truncate">{d.quotation?.quote_number ?? 'Draf'}{d.invoice ? ` · ${d.invoice.number}` : ''}</span><span className="text-[12px] font-bold text-gray-900 font-mono shrink-0">{rm(d.amount)}</span></div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {d.accepted_at && d.stage === 'quote' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Accepted</span>}
          {d.deposit_paid_at && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Deposit ✓</span>}
          {d.balance_paid_at && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Lunas</span>}
          {cd && !d.delivered_at && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${cd.cls}`}><CalendarDays className="h-3 w-3" />{cd.text}</span>}
          {d.alerts.map((a, i) => <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${a.level === 'danger' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}><AlertTriangle className="h-3 w-3" />{a.text}</span>)}
        </div>
        {d.next_action && <p className="text-[10px] text-gray-500 mt-1.5 truncate">→ {d.next_action}{d.next_action_at ? ` · ${fmtD(d.next_action_at)}` : ''}</p>}
      </button>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pipeline Gift</h1>
          <p className="text-sm text-gray-500">Deal gift kurma dari sebut harga hingga selesai. {summary ? `${summary.count} deal · ${rm(summary.total)}${summary.alerts ? ` · ${summary.alerts} amaran` : ''}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative"><Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari klien / PO" className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-52 focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
          <select value={scope} onChange={e => setScope(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white"><option value="active">Aktif</option><option value="all">Semua</option><option value="done">Selesai</option><option value="lost">Batal / Kalah</option></select>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white">
            <button type="button" onClick={() => setView('board')} className={`h-8 w-8 grid place-items-center rounded-md ${view === 'board' ? 'bg-gray-900 text-white' : 'text-gray-500'}`} aria-label="Papan"><LayoutGrid className="h-4 w-4" /></button>
            <button type="button" onClick={() => setView('list')} className={`h-8 w-8 grid place-items-center rounded-md ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500'}`} aria-label="Senarai"><List className="h-4 w-4" /></button>
          </div>
          <Link href="/admin/quotations/new" className={btnPrimary}>Sebut harga baharu</Link>
        </div>
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-3" role="alert">{error}</div>}
      <p className="text-[11px] text-gray-400 mb-3">Deal lahir automatik bila sebut harga dikeluarkan. Peringkat maju sendiri dari invois & bayaran; kau boleh tukar bila-bila. Khas gift kurma, bukan order kedai.</p>

      {loading ? <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        : view === 'board' ? (
          <div className="overflow-x-auto pb-3 -mx-1 px-1">
            <div className="grid grid-flow-col auto-cols-[minmax(170px,1fr)] gap-2 min-w-full">
              {columns.map(col => (
                <div key={col.stage} className="rounded-xl bg-gray-50 border border-gray-200 p-1.5 flex flex-col gap-1.5 min-h-[200px] min-w-0">
                  <div className="px-1">
                    <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600 truncate"><span className={`h-2 w-2 rounded-full shrink-0 ${STAGE_DOT[col.stage]}`} />{STAGE_LABEL[col.stage]}</span><span className="text-[11px] font-bold text-gray-500">{col.deals.length}</span></div>
                    <p className="text-[10px] text-gray-400 truncate" title={STAGE_HINT[col.stage]}>{summary?.byStage?.[col.stage]?.total ? rm(summary.byStage[col.stage].total) : STAGE_HINT[col.stage]}</p>
                  </div>
                  {col.deals.length === 0 ? <p className="text-[11px] text-gray-300 text-center py-6">—</p> : col.deals.map(card)}
                </div>
              ))}
              {scope !== 'active' && closed.length > 0 && (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-1.5 flex flex-col gap-1.5 min-w-0">
                  <div className="px-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-gray-600 truncate">Selesai / Batal</span><span className="text-[11px] font-bold text-gray-500">{closed.length}</span></div>
                  {closed.map(card)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500"><tr>
                <th className="text-left font-bold px-3 py-2.5">Peringkat</th><th className="text-left font-bold px-3 py-2.5">Deal</th><th className="text-left font-bold px-3 py-2.5">Sebut harga / Invois</th><th className="text-right font-bold px-3 py-2.5">Jumlah</th><th className="text-left font-bold px-3 py-2.5">Deposit</th><th className="text-left font-bold px-3 py-2.5">Perlu hantar</th><th className="text-left font-bold px-3 py-2.5">Tindakan seterusnya</th><th className="text-left font-bold px-3 py-2.5">Amaran</th>
              </tr></thead>
              <tbody>
                {deals.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">Tiada deal.</td></tr> : deals.map(d => (
                  <tr key={d.id} onClick={() => setOpenId(d.id)} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <td className="px-3 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700"><span className={`h-2 w-2 rounded-full ${STAGE_DOT[d.stage]}`} />{stageLabel(d.stage)}</span></td>
                    <td className="px-3 py-2.5 text-gray-900 max-w-[280px] truncate">{d.title ?? d.client.company ?? d.client.name}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{d.quotation?.quote_number ?? '—'}{d.invoice ? ` · ${d.invoice.number}` : ''}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{rm(d.amount)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{d.deposit_pct}%{d.deposit_paid_at ? ' ✓' : ''}{d.balance_paid_at ? ' · Lunas' : ''}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">{fmtD(d.needed_by)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[200px] truncate">{d.next_action ?? '—'}{d.next_action_at ? ` · ${fmtD(d.next_action_at)}` : ''}</td>
                    <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{d.alerts.map((a, i) => <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${a.level === 'danger' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{a.text}</span>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Panel deal */}
      {openId && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpenId(null)} />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[560px] bg-white shadow-2xl overflow-y-auto">
            {!detail ? <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Deal</p>
                    <h2 className="text-lg font-bold text-gray-900 leading-snug">{detail.title ?? detail.client.company ?? detail.client.name}</h2>
                    <p className="text-sm text-gray-500">{detail.client.company && detail.client.name ? `${detail.client.name} · ` : ''}{detail.client.phone ?? ''}{detail.client.email ? ` · ${detail.client.email}` : ''}</p>
                  </div>
                  <button type="button" onClick={() => setOpenId(null)} className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600" aria-label="Tutup"><X className="h-4 w-4" /></button>
                </div>
                {detail.alerts.length > 0 && <div className="flex flex-wrap gap-1">{detail.alerts.map((a, i) => <span key={i} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${a.level === 'danger' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}><AlertTriangle className="h-3 w-3" />{a.text}</span>)}</div>}

                {/* Peringkat + tindakan seterusnya */}
                <div className={sec}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><label className={lbl}>Peringkat</label><select value={form.stage ?? detail.stage} onChange={e => f('stage', e.target.value)} className={inp}>{ALL_STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s as DealStage]}</option>)}</select></div>
                    <div><label className={lbl}>Tajuk deal</label><input value={form.title ?? ''} onChange={e => f('title', e.target.value)} className={inp} /></div>
                    <div className="sm:col-span-2 grid grid-cols-[1fr_150px] gap-2"><div><label className={lbl}>Tindakan seterusnya</label><input value={form.next_action ?? ''} onChange={e => f('next_action', e.target.value)} placeholder="cth. Call Puan Aisyah sahkan artwork" className={inp} /></div><div><label className={lbl}>Tarikh</label><input type="date" value={form.next_action_at ?? ''} onChange={e => f('next_action_at', e.target.value)} className={inp} /></div></div>
                    {(form.stage === 'lost' || detail.stage === 'lost') && <div className="sm:col-span-2"><label className={lbl}>Sebab batal / kalah</label><input list="lost-reasons" value={form.lost_reason ?? ''} onChange={e => f('lost_reason', e.target.value)} className={inp} /><datalist id="lost-reasons">{LOST_REASONS.map(r => <option key={r} value={r} />)}</datalist></div>}
                  </div>
                </div>

                {/* Sebut harga & invois */}
                <div className={sec}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Sebut harga & invois</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {detail.quotation_id ? <Link href={`/admin/quotations/${detail.quotation_id}`} className="font-semibold text-gray-900 hover:underline">{detail.quotation?.quote_number ?? 'Sebut harga'}</Link> : <span className="text-gray-400">Tiada sebut harga</span>}
                    {detail.quotation && <span className="text-xs text-gray-500">{detail.quotation.status}{detail.accepted_at ? ` · Accepted ${fmtDT(detail.accepted_at)}` : ''}{detail.quotation.valid_until ? ` · sah hingga ${fmtD(detail.quotation.valid_until)}` : ''}</span>}
                    {detail.quotation_id && <a href={`/api/admin/quotations/${detail.quotation_id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"><FileText className="h-3.5 w-3.5" />PDF</a>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-2">
                    {detail.invoice ? <><span className="font-semibold text-gray-900">{detail.invoice.number}</span><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${detail.invoice.status === 'PAID' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{detail.invoice.status}</span>{detail.invoice.pdf && <a href={detail.invoice.pdf} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"><FileText className="h-3.5 w-3.5" />PDF</a>}{detail.invoice.link && <a href={detail.invoice.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"><ExternalLink className="h-3.5 w-3.5" />Refrens</a>}</>
                      : <span className="text-xs text-gray-500">Belum ada invois — tekan &quot;Convert to Invoice&quot; dalam sebut harga bila klien minta invois.</span>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <div><label className={lbl}>No. PO / LO klien</label><input value={form.po_number ?? ''} onChange={e => f('po_number', e.target.value)} className={inp} placeholder="Pilihan — korporat/kerajaan" /></div>
                    <div><label className={lbl}>Pautan fail PO</label><input value={form.po_file_url ?? ''} onChange={e => f('po_file_url', e.target.value)} className={inp} placeholder="https://…" /></div>
                  </div>
                </div>

                {/* Bayaran */}
                <div className={sec}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Bayaran · jumlah {rm(detail.amount)}</p>
                    <button type="button" onClick={sync} disabled={busy === 'sync' || !detail.invoice} title={detail.invoice ? 'Tarik bayaran dari invois Refrens' : 'Tiada invois Refrens'} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-40">{busy === 'sync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Segerak Refrens</button>
                  </div>
                  <div className="grid sm:grid-cols-[120px_1fr] gap-3 items-end">
                    <div><label className={lbl}>Deposit %</label><input type="number" min="0" max="100" value={form.deposit_pct ?? ''} onChange={e => f('deposit_pct', e.target.value)} className={`${inp} font-mono`} /></div>
                    <p className="text-xs text-gray-500 pb-2">0% = klien bayar penuh selepas hantar (tender/LO). Deposit perlu {rm(depositDue({ amount: detail.amount, deposit_pct: Number(form.deposit_pct ?? detail.deposit_pct) }))}.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                      <p className="text-xs font-bold text-gray-700">Deposit</p>
                      {detail.deposit_paid_at ? <p className="text-sm text-gray-900 mt-1"><CheckCircle2 className="h-4 w-4 inline text-green-600 mr-1" />{rm(detail.deposit_amount ?? 0)} · {fmtD(detail.deposit_paid_at)}<span className="block text-[11px] text-gray-500">{detail.deposit_source}{detail.deposit_ref ? ` · ${detail.deposit_ref}` : ''}</span></p>
                        : Number(form.deposit_pct ?? detail.deposit_pct) === 0 ? <p className="text-xs text-gray-500 mt-1">Tiada deposit (0%).</p>
                        : <button type="button" onClick={() => openPay('deposit')} className={`${btnGhost} mt-2`}><Banknote className="h-4 w-4" />Tanda deposit dibayar</button>}
                    </div>
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                      <p className="text-xs font-bold text-gray-700">Baki · perlu {rm(balanceDue(detail))}</p>
                      {detail.balance_paid_at ? <p className="text-sm text-gray-900 mt-1"><CheckCircle2 className="h-4 w-4 inline text-green-600 mr-1" />{rm(detail.balance_amount ?? 0)} · {fmtD(detail.balance_paid_at)}<span className="block text-[11px] text-gray-500">{detail.balance_source}{detail.balance_ref ? ` · ${detail.balance_ref}` : ''}</span></p>
                        : <button type="button" onClick={() => openPay('balance')} className={`${btnGhost} mt-2`}><Banknote className="h-4 w-4" />Tanda baki dibayar</button>}
                    </div>
                  </div>
                  {payOpen && (
                    <div className="mt-3 rounded-lg border border-gray-900 p-3">
                      <p className="text-xs font-bold text-gray-900 mb-2">Tanda {payOpen === 'deposit' ? 'deposit' : 'baki'} dibayar</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <label className="text-xs font-semibold text-gray-600">Jumlah<input type="number" min="0.01" step="0.01" value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: e.target.value }))} className={`${inp} mt-1 font-mono`} /></label>
                        <label className="text-xs font-semibold text-gray-600">Tarikh<input type="date" value={pay.date} onChange={e => setPay(p => ({ ...p, date: e.target.value }))} className={`${inp} mt-1`} /></label>
                        <label className="text-xs font-semibold text-gray-600">Kaedah<select value={pay.method} onChange={e => setPay(p => ({ ...p, method: e.target.value }))} className={`${inp} mt-1`}>{PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                        <label className="text-xs font-semibold text-gray-600">Rujukan<input value={pay.ref} onChange={e => setPay(p => ({ ...p, ref: e.target.value }))} className={`${inp} mt-1`} placeholder="No. transaksi" /></label>
                      </div>
                      <label className={`inline-flex items-center gap-2 text-xs mt-2 ${detail.invoice ? 'text-gray-700' : 'text-gray-400'}`}><input type="checkbox" checked={pay.also && !!detail.invoice} disabled={!detail.invoice} onChange={e => setPay(p => ({ ...p, also: e.target.checked }))} className="accent-gray-900" />Rekod juga pada invois Refrens {detail.invoice ? detail.invoice.number : '(tiada invois)'}</label>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {confirmPay ? <span className="inline-flex items-center gap-2 text-sm"><span className="text-gray-600">Sahkan {rm(Number(pay.amount) || 0)}?</span><button type="button" onClick={submitPay} disabled={busy === 'pay'} className="font-bold text-gray-900 inline-flex items-center gap-1">{busy === 'pay' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Ya</button><button type="button" onClick={() => setConfirmPay(false)} className="text-gray-500">Tidak</button></span>
                          : <button type="button" onClick={() => setConfirmPay(true)} disabled={!(Number(pay.amount) > 0)} className={btnPrimary}><Banknote className="h-4 w-4" />Tanda dibayar</button>}
                        <button type="button" onClick={() => setPayOpen(null)} className={btnGhost}>Tutup</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Artwork & produksi */}
                <div className={sec}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Artwork & produksi</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><label className={lbl}>Artwork disahkan</label><div className="flex gap-1"><input type="date" value={form.artwork_approved_at ?? ''} onChange={e => f('artwork_approved_at', e.target.value)} className={inp} />{!detail.artwork_approved_at && <button type="button" onClick={markArtwork} title="Tanda hari ini" className="h-8 px-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-gray-400 whitespace-nowrap">Hari ini</button>}</div></div>
                    <div><label className={lbl}>Disahkan oleh</label><input value={form.artwork_by ?? ''} onChange={e => f('artwork_by', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Pautan mockup akhir</label><input value={form.artwork_file_url ?? ''} onChange={e => f('artwork_file_url', e.target.value)} className={inp} placeholder="https://…" /></div>
                    <div><label className={lbl}>Sasaran siap produksi</label><input type="date" value={form.production_due ?? ''} onChange={e => f('production_due', e.target.value)} className={inp} /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Tarikh perlu hantar (klien)</label><input type="date" value={form.needed_by ?? ''} onChange={e => f('needed_by', e.target.value)} className={inp} /></div>
                  </div>
                </div>

                {/* Penghantaran */}
                <div className={sec}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Penghantaran</p>
                    {!detail.delivered_at && <button type="button" onClick={markDelivered} disabled={busy === 'save'} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"><Truck className="h-3.5 w-3.5" />Tanda dihantar hari ini</button>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div><label className={lbl}>Tarikh dihantar</label><input type="date" value={form.delivered_at ?? ''} onChange={e => f('delivered_at', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Cara hantar</label><select value={form.delivery_method ?? ''} onChange={e => f('delivery_method', e.target.value)} className={inp}><option value="">—</option>{DELIVERY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                    <div><label className={lbl}>No. tracking</label><input value={form.tracking_no ?? ''} onChange={e => f('tracking_no', e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Diterima oleh</label><input value={form.received_by ?? ''} onChange={e => f('received_by', e.target.value)} className={inp} /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Pautan foto bukti terima (POD)</label><input value={form.pod_url ?? ''} onChange={e => f('pod_url', e.target.value)} className={inp} placeholder="https://… (Google Drive / WhatsApp export)" /></div>
                  </div>
                </div>

                <div className={sec}><label className={lbl}>Nota dalaman</label><textarea value={form.notes ?? ''} onChange={e => f('notes', e.target.value)} rows={3} className={inp} /></div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-400">Dikemas kini {fmtDT(detail.updated_at)}</span>
                  <button type="button" onClick={() => saveDetail()} disabled={busy === 'save'} className={btnPrimary}>{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Simpan</button>
                </div>

                {detail.events.length > 0 && (
                  <div className={sec}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Sejarah</p>
                    <ul className="text-xs space-y-1.5 text-gray-700">
                      {detail.events.map(ev => <li key={ev.id} className="flex flex-wrap gap-x-2"><span className="text-gray-400 w-28 shrink-0">{fmtDT(ev.created_at)}</span><span className="font-semibold">{EVENT_LABEL[ev.type] ?? ev.type}</span><span className="text-gray-500">{Object.entries(ev.meta ?? {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : String(v)}`).join(' · ')}{ev.actor ? ` · ${ev.actor}` : ''}</span></li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
