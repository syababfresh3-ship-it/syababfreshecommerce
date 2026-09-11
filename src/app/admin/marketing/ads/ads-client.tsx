'use client'

// Ad Spend & ROAS (Sprint 3 fasa 2, audit §4 ROAS).
// Entri manual harian ikut kempen. Padanan hasil: order LP dengan `source`
// "fb/<campaign_id>" → ROAS = hasil order aktif / spend, CAC = spend / order.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, TrendingUp, Pencil, Check, X } from 'lucide-react'
import type { AdSpendRow, RoasSummary } from '@/lib/roas'

interface SourceHint { campaign_id: string; channel: string; orders: number; revenue: number }

const CHANNELS = [
  { id: 'meta', label: 'Meta (FB/IG/Threads)' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'google', label: 'Google' },
  { id: 'other', label: 'Lain-lain' },
]

function mytToday() {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
}
function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}
const rm = (n: number) => `RM${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function AdsClient() {
  const [month, setMonth] = useState(mytToday().slice(0, 7))
  const [rows, setRows] = useState<AdSpendRow[]>([])
  const [summary, setSummary] = useState<RoasSummary | null>(null)
  const [sources, setSources] = useState<SourceHint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [form, setForm] = useState({ spend_date: mytToday(), channel: 'meta', campaign_id: '', campaign_name: '', lp_slug: '', amount: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const { from, to } = monthRange(month)
    const res = await fetch(`/api/admin/ad-spend?from=${from}&to=${to}&summary=1`)
    const j = await res.json()
    if (!res.ok) { setError(j.error ?? 'Gagal muat'); setLoading(false); return }
    setRows(j.rows ?? []); setSummary(j.summary ?? null); setSources(j.sources ?? [])
    setLoading(false)
  }, [month])
  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) < 0) { toast.error('Isi jumlah'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ad-spend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, amount: Number(form.amount) }) })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error ?? 'Gagal simpan'); return }
      toast.success('Perbelanjaan disimpan')
      setForm(f => ({ ...f, amount: '', notes: '' }))
      load()
    } finally { setSaving(false) }
  }

  async function saveEdit(id: string) {
    const res = await fetch('/api/admin/ad-spend', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, amount: Number(editAmount) }) })
    if (!res.ok) { toast.error('Gagal kemas kini'); return }
    setEditId(null); load()
  }

  async function remove(r: AdSpendRow) {
    if (!window.confirm(`Padam ${rm(r.amount)} (${r.spend_date}, ${r.channel})?`)) return
    const res = await fetch(`/api/admin/ad-spend?id=${r.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Gagal padam'); return }
    load()
  }

  const totalSpend = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows])
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white'
  const lbl = 'text-[11px] font-bold text-gray-500 block mb-1'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="h-5 w-5" />Ad Spend &amp; ROAS</h1>
          <p className="text-sm text-gray-500 mt-0.5">Masukkan perbelanjaan iklan harian ikut kempen. Hasil dipadankan dari order LP yang bawa id kempen (contoh <code className="bg-gray-100 px-1 rounded">fb/52520982596515</code>).</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white" />
      </div>

      {error && <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">{error}</div>}

      {/* Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Spend bulan ini', value: rm(totalSpend) },
          { label: 'Hasil dipadankan', value: summary ? rm(summary.revenue) : '—', sub: summary ? `${summary.orders} order` : '' },
          { label: 'ROAS', value: summary?.roas != null ? `${summary.roas.toFixed(2)}x` : '—', sub: 'hasil ÷ spend' },
          { label: 'CAC', value: summary?.cac != null ? rm(summary.cac) : '—', sub: 'spend ÷ order' },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t.label}</p>
            <p className="text-xl font-black text-gray-900 mt-1">{t.value}</p>
            {t.sub && <p className="text-[11px] text-gray-400 mt-0.5">{t.sub}</p>}
          </div>
        ))}
      </div>
      {summary && summary.unmatchedSpend > 0 && (
        <p className="text-xs text-gray-500">{rm(summary.unmatchedSpend)} spend tanpa id kempen tidak dapat dipadankan ke order (dikira dalam jumlah, bukan dalam ROAS kempen).</p>
      )}

      {/* Borang tambah */}
      <form onSubmit={add} className="bg-white rounded-2xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <div><label className={lbl}>Tarikh</label><input type="date" className={inp} value={form.spend_date} onChange={e => setForm(f => ({ ...f, spend_date: e.target.value }))} required /></div>
        <div><label className={lbl}>Saluran</label>
          <select className={inp} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>ID kempen (padan `source` order)</label>
          <input list="campaign-ids" className={inp} value={form.campaign_id} onChange={e => setForm(f => ({ ...f, campaign_id: e.target.value.replace(/\D/g, '') }))} placeholder="52520982596515" />
          <datalist id="campaign-ids">{sources.map(s => <option key={s.campaign_id} value={s.campaign_id}>{`${s.channel} · ${s.orders} order · ${rm(s.revenue)}`}</option>)}</datalist>
        </div>
        <div><label className={lbl}>Nama kempen (pilihan)</label><input className={inp} value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} placeholder="Ceri Turki Sept" /></div>
        <div><label className={lbl}>Jumlah (RM)</label><input type="number" step="0.01" min="0" inputMode="decimal" className={inp} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="120.00" required /></div>
        <button type="submit" disabled={saving} className="h-[38px] rounded-xl bg-gray-900 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Tambah
        </button>
      </form>
      {sources.length > 0 && (
        <p className="text-[11px] text-gray-400">Id kempen yang pernah bawa order bulan ini: {sources.slice(0, 6).map(s => `${s.channel}/${s.campaign_id} (${s.orders})`).join(', ')}{sources.length > 6 ? ', …' : ''}. Taip id untuk cadangan automatik.</p>
      )}

      {/* Ikut kempen */}
      {summary && summary.byCampaign.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs"><tr>
              <th className="text-left px-4 py-2">Kempen</th><th className="text-left px-4 py-2">Saluran</th><th className="text-right px-4 py-2">Spend</th><th className="text-right px-4 py-2">Order</th><th className="text-right px-4 py-2">Hasil</th><th className="text-right px-4 py-2">ROAS</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {summary.byCampaign.map(c => (
                <tr key={c.campaign_id}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-800">{c.campaign_id}{c.name ? <span className="font-sans text-gray-500"> · {c.name}</span> : ''}</td>
                  <td className="px-4 py-2 text-gray-600">{c.channel}</td>
                  <td className="px-4 py-2 text-right">{rm(c.spend)}</td>
                  <td className="px-4 py-2 text-right">{c.orders}</td>
                  <td className="px-4 py-2 text-right">{rm(c.revenue)}</td>
                  <td className="px-4 py-2 text-right font-bold text-gray-900">{c.roas != null ? `${c.roas.toFixed(2)}x` : (c.orders > 0 ? 'tiada spend' : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Senarai baris */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs"><tr>
            <th className="text-left px-4 py-2">Tarikh</th><th className="text-left px-4 py-2">Saluran</th><th className="text-left px-4 py-2">Kempen</th><th className="text-left px-4 py-2">LP</th><th className="text-right px-4 py-2">Jumlah</th><th className="px-4 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /> Memuatkan…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Tiada perbelanjaan direkod untuk bulan ini.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-gray-800">{r.spend_date}</td>
                <td className="px-4 py-2 text-gray-600">{r.channel}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.campaign_id ?? '—'}{r.campaign_name ? <span className="font-sans text-gray-500"> · {r.campaign_name}</span> : ''}</td>
                <td className="px-4 py-2 text-gray-500">{r.lp_slug ?? '—'}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {editId === r.id ? (
                    <span className="inline-flex items-center gap-1">
                      <input type="number" step="0.01" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right" autoFocus />
                      <button type="button" onClick={() => saveEdit(r.id)} className="p-1 rounded hover:bg-gray-100" aria-label="Simpan"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setEditId(null)} className="p-1 rounded hover:bg-gray-100" aria-label="Batal"><X className="h-4 w-4" /></button>
                    </span>
                  ) : rm(r.amount)}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button type="button" onClick={() => { setEditId(r.id); setEditAmount(String(r.amount)) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => remove(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Padam"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr className="bg-gray-50"><td colSpan={4} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Jumlah</td><td className="px-4 py-2 text-right font-black text-gray-900">{rm(totalSpend)}</td><td /></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
