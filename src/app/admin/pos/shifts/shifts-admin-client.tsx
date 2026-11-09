'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, Loader2 } from 'lucide-react'
import { rm } from '@/lib/pos/money'
import { fmtKl } from '@/lib/pos/receipt'
import { klDateStr } from '@/lib/pos/dates'
import type { PosShiftRow } from '@/lib/pos/shifts'

// Shift POS (buka/tutup kedai) untuk semakan pemilik: float, jualan, tunai dijangka vs dikira, beza.
// Shift terbuka → pautan laporan X langsung; tertutup → laporan Z. UI Bahasa Inggeris.

export function PosShiftsAdminClient() {
  // Lalai 7 hari terakhir — dikira sekali dalam initializer (Date.now() tak boleh dipanggil semasa render)
  const [from, setFrom] = useState(() => klDateStr(new Date(Date.now() - 6 * 86400_000)))
  const [to, setTo] = useState(() => klDateStr(new Date()))
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<PosShiftRow[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const key = `${from}|${to}|${status}`
  const loading = loadedKey !== key

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/pos/shifts?from=${from}&to=${to}${status ? `&status=${status}` : ''}`).then(async res => {
      const j = await res.json().catch(() => ({}))
      if (!alive) return
      if (!res.ok) toast.error(j.error ?? 'Failed to load')
      setRows(j.shifts ?? []); setLoadedKey(key)
    }).catch(() => { if (alive) setLoadedKey(key) })
    return () => { alive = false }
  }, [from, to, status, key])

  const closed = rows.filter(r => r.status === 'closed')
  const totalVar = closed.reduce((s, r) => s + Number(r.variance ?? 0), 0)
  const totalRev = closed.reduce((s, r) => s + Number(r.summary?.revenue ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">POS Shifts</h1><p className="text-sm text-gray-500">Store open / close per register · {rows.length} shifts · closed revenue {rm(totalRev)} · cash difference {totalVar === 0 ? 'exact' : `${totalVar > 0 ? 'over' : 'short'} ${rm(Math.abs(totalVar))}`}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm" />
          <span className="text-gray-400">–</span>
          <input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"><option value="">All</option><option value="open">Open now</option><option value="closed">Closed</option></select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">Register</th><th className="px-3 py-2">Opened</th><th className="px-3 py-2">Closed</th><th className="px-3 py-2 text-right">Float</th><th className="px-3 py-2 text-right">Sales</th><th className="px-3 py-2 text-right">Revenue</th><th className="px-3 py-2 text-right">Cash sales</th><th className="px-3 py-2 text-right">Expected</th><th className="px-3 py-2 text-right">Counted</th><th className="px-3 py-2 text-right">Cash diff</th><th className="px-3 py-2 text-right">QR / card diff</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={13} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={13} className="px-3 py-8 text-center text-gray-400">No shifts in this period.</td></tr>}
            {rows.map(r => {
              const v = Number(r.variance ?? 0)
              const s = r.summary
              // Beza bukan tunai: jumlah (diisytihar − sistem) bagi QR / kad / e-wallet; null = tidak diisytihar (shift lama / tiada jualan)
              const others = Object.entries(s?.tenderVariance ?? {}).filter(([m]) => m !== 'cash')
              const ov = others.length ? others.reduce((a, [, d]) => a + Number(d), 0) : null
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold text-gray-900">{r.pos_registers?.code ?? '—'} <span className="font-normal text-gray-400">{r.pos_registers?.name}</span></td>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{fmtKl(r.opened_at)}<span className="block text-gray-400">{r.opener?.name ?? 'admin'}</span></td>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{r.closed_at ? <>{fmtKl(r.closed_at)}<span className="block text-gray-400">{r.closer?.name ?? 'admin'}</span></> : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rm(Number(r.opening_float))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s ? s.sales : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{s ? rm(s.revenue) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s ? rm(s.cashSales) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.expected_cash != null ? rm(Number(r.expected_cash)) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.counted_cash != null ? rm(Number(r.counted_cash)) : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.status === 'closed' && v !== 0 ? 'text-amber-700' : 'text-gray-700'}`}>{r.status !== 'closed' ? '—' : v === 0 ? 'Exact' : `${v > 0 ? '+' : '−'}${rm(Math.abs(v))}`}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${ov ? 'text-amber-700' : 'text-gray-700'}`}>{ov === null ? '—' : ov === 0 ? 'Exact' : `${ov > 0 ? '+' : '−'}${rm(Math.abs(ov))}`}</td>
                  <td className="px-3 py-2"><span className={`inline-flex h-6 px-2 items-center rounded-md border text-[11px] font-bold uppercase ${r.status === 'open' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600'}`}>{r.status}</span></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap"><a href={`/pos/shift-report/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex h-8 px-2.5 items-center gap-1 rounded-md border border-gray-300 text-xs font-semibold"><ExternalLink className="h-3.5 w-3.5" /> {r.status === 'open' ? 'X report' : 'Z report'}</a></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Cash diff = cash counted at close − expected (opening float + cash sales + cash in − cash out). QR / card diff = totals staff declared from the bank app and terminal slips − what the POS recorded. Notes entered at close appear on the Z report.</p>
    </div>
  )
}
