'use client'

// Ad Spend & ROAS (Sprint 3 fasa 2, audit §4 ROAS).
// Spend Meta ditarik AUTOMATIK harian (cron meta-ad-spend, baris notes 'auto:meta').
// Borang manual & padanan sumber dibuang dari UI 24 Sep 2026 (pemilik: susah guna) —
// API POST/PATCH kekal; alias sumber→kempen diset terus di app_settings. Padanan hasil: order LP dengan `source`
// "fb/<campaign_id>" → ROAS = hasil order aktif / spend, CAC = spend / order.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Trash2, TrendingUp, Pencil, Check, X } from 'lucide-react'
import type { AdSpendRow, RoasSummary } from '@/lib/roas'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  // Muat semula = naikkan reloadKey; effect di bawah yang fetch (tiada setState segerak dalam effect)
  const [reloadKey, setReloadKey] = useState(0)
  const load = useCallback(() => { setLoading(true); setReloadKey(k => k + 1) }, [])
  useEffect(() => {
    let alive = true
    const { from, to } = monthRange(month)
    fetch(`/api/admin/ad-spend?from=${from}&to=${to}&summary=1`)
      .then(async res => {
        const j = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) { setError(j.error ?? 'Failed to load'); setLoading(false); return }
        setError(null); setRows(j.rows ?? []); setSummary(j.summary ?? null); setLoading(false)
      })
      .catch(() => { if (alive) { setError('Failed to load'); setLoading(false) } })
    return () => { alive = false }
  }, [month, reloadKey])

  async function saveEdit(id: string) {
    const res = await fetch('/api/admin/ad-spend', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, amount: Number(editAmount) }) })
    if (!res.ok) { toast.error('Update failed'); return }
    setEditId(null); load()
  }

  async function remove(r: AdSpendRow) {
    if (!window.confirm(`Delete ${rm(r.amount)} (${r.spend_date}, ${r.channel})?`)) return
    const res = await fetch(`/api/admin/ad-spend?id=${r.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Delete failed'); return }
    load()
  }

  const totalSpend = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><TrendingUp className="h-5 w-5" />Ad Spend &amp; ROAS</h1>
          <p className="text-sm text-gray-500 mt-0.5">Meta spend is pulled automatically every day from the ad account (rows marked <span className="inline-block text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600 px-1.5 rounded">auto</span>). Revenue is matched from LP orders that carry the campaign id (e.g. <code className="bg-gray-100 px-1 rounded">fb/52520982596515</code>).</p>
        </div>
        <input type="month" value={month} onChange={e => { setMonth(e.target.value); setLoading(true) }} className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white" />
      </div>

      {error && <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">{error}</div>}

      {/* Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Spend this month', value: rm(totalSpend) },
          { label: 'Leads (WA conversations)', value: summary?.conversations ? String(summary.conversations) : '—', sub: summary?.conversations && totalSpend > 0 ? `cost/lead ${rm(totalSpend / summary.conversations)}` : 'from Click-to-WhatsApp ads' },
          { label: 'Matched revenue', value: summary ? rm(summary.revenue) : '—', sub: summary ? `${summary.orders} orders` : '' },
          { label: 'ROAS', value: summary?.roas != null ? `${summary.roas.toFixed(2)}x` : '—', sub: 'revenue ÷ spend' },
          { label: 'CAC', value: summary?.cac != null ? rm(summary.cac) : '—', sub: 'spend ÷ orders' },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{t.label}</p>
            <p className="text-xl font-black text-gray-900 mt-1">{t.value}</p>
            {t.sub && <p className="text-[11px] text-gray-400 mt-0.5">{t.sub}</p>}
          </div>
        ))}
      </div>
      {summary && summary.unmatchedSpend > 0 && (
        <p className="text-xs text-gray-500">{rm(summary.unmatchedSpend)} of spend has no campaign id and cannot be matched to orders (counted in the total, not in campaign ROAS).</p>
      )}

      {/* Ikut kempen */}
      {summary && summary.byCampaign.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs"><tr>
              <th className="text-left px-4 py-2">Campaign</th>
              <th className="text-right px-3 py-2">Spend</th>
              <th className="text-right px-3 py-2">Clicks</th>
              <th className="text-right px-3 py-2 font-bold text-gray-700">Leads</th>
              <th className="text-right px-3 py-2">Cost / lead</th>
              <th className="text-right px-3 py-2">Replied</th>
              <th className="text-right px-3 py-2">≥2 messages</th>
              <th className="text-right px-3 py-2">Orders</th>
              <th className="text-right px-3 py-2">Lead→Order</th>
              <th className="text-right px-3 py-2">Revenue</th>
              <th className="text-right px-4 py-2">ROAS</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {summary.byCampaign.map(c => (
                <tr key={c.campaign_id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{c.name ?? c.campaign_id}</div>
                    <div className="font-mono text-[11px] text-gray-400">{c.campaign_id} · {c.channel}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{rm(c.spend)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{c.clicks || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900">{c.conversations || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.costPerLead != null ? rm(c.costPerLead) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{c.replies || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{c.depth2 || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.orders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.leadToOrder != null && c.leadToOrder <= 1 ? `${(c.leadToOrder * 100).toFixed(1)}%` : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rm(c.revenue)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold text-gray-900">{c.roas != null ? `${c.roas.toFixed(2)}x` : (c.orders > 0 ? 'no spend' : '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-50">Leads = WhatsApp conversations started from ads (Meta). Orders for WhatsApp campaigns are matched via the staff Quick Order source (e.g. whatsapp-Pika). Lead→Order is shown only when orders come from those conversations.</p>
        </div>
      )}

      {/* Senarai baris */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs"><tr>
            <th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Channel</th><th className="text-left px-4 py-2">Campaign</th><th className="text-left px-4 py-2">LP</th><th className="text-right px-4 py-2">Amount</th><th className="px-4 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No ad spend recorded for this month.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-gray-800">{r.spend_date}</td>
                <td className="px-4 py-2 text-gray-600">{r.channel}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.campaign_id ?? '—'}{r.campaign_name ? <span className="font-sans text-gray-500"> · {r.campaign_name}</span> : ''}</td>
                <td className="px-4 py-2 text-gray-500">{r.lp_slug ?? '—'}{r.notes === 'auto:meta' && <span className="ml-1.5 inline-block text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-600 px-1.5 rounded">auto</span>}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {editId === r.id ? (
                    <span className="inline-flex items-center gap-1">
                      <input type="number" step="0.01" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right" autoFocus />
                      <button type="button" onClick={() => saveEdit(r.id)} className="p-1 rounded hover:bg-gray-100" aria-label="Save"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setEditId(null)} className="p-1 rounded hover:bg-gray-100" aria-label="Cancel"><X className="h-4 w-4" /></button>
                    </span>
                  ) : rm(r.amount)}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">{r.notes === 'auto:meta' ? <span className="text-[10px] text-gray-300">—</span> : (<>
                  <button type="button" onClick={() => { setEditId(r.id); setEditAmount(String(r.amount)) }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => remove(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                </>)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr className="bg-gray-50"><td colSpan={4} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Total</td><td className="px-4 py-2 text-right font-black text-gray-900">{rm(totalSpend)}</td><td /></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
