'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

// Jadual "Order guna kupon" & "Order redeem points" — pagination 20 baris + carian (order / customer / kod),
// gaya sama seperti CouponCodesTable. Data dimuatkan server-side (≤600 baris); di sini potong ikut page sahaja.
const PAGE_SIZE = 20
const fmtDate = (s: string) => new Date(s).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: '2-digit' })

export interface UsageRow { order: string; customer: string; code?: string; pts?: number; amount: number; date: string; src: string }

export function OrderUsageTable({ rows: all, kind }: { rows: UsageRow[]; kind: 'coupon' | 'points' }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return all
    return all.filter((r) => [r.order, r.customer, r.code ?? ''].some((v) => String(v).toUpperCase().includes(q)))
  }, [all, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)
  const emptyAll = kind === 'coupon' ? 'Belum ada order guna kupon.' : 'Belum ada redeem points.'

  return (
    <div className="space-y-2">
      <div className="relative max-w-xs">
        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0) }}
          placeholder={kind === 'coupon' ? 'Cari order / customer / kod…' : 'Cari order / customer…'}
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-4 py-2">Order</th><th className="text-left px-4 py-2">Customer</th>
              {kind === 'coupon' ? <th className="text-left px-4 py-2">Kod</th> : <th className="text-right px-4 py-2">Points</th>}
              <th className="text-right px-4 py-2">{kind === 'coupon' ? 'Diskaun' : 'Nilai'}</th>
              <th className="text-left px-4 py-2">Sumber</th><th className="text-left px-4 py-2">Tarikh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r, i) => (
              <tr key={`${r.order}-${start + i}`}>
                <td className="px-4 py-2 font-mono text-gray-700">{r.order}</td>
                <td className="px-4 py-2 text-gray-800">{r.customer}</td>
                {kind === 'coupon'
                  ? <td className="px-4 py-2 font-mono text-violet-600">{r.code}</td>
                  : <td className="px-4 py-2 text-right font-semibold text-amber-600">{Number(r.pts ?? 0).toLocaleString()}</td>}
                <td className={`px-4 py-2 text-right text-red-600 ${kind === 'coupon' ? 'font-semibold' : ''}`}>−RM{r.amount.toFixed(2)}</td>
                <td className="px-4 py-2 text-gray-400 text-xs">{r.src}</td>
                <td className="px-4 py-2 text-gray-400">{fmtDate(r.date)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">{all.length === 0 ? emptyAll : 'Tiada order sepadan carian.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Menunjukkan {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} drpd {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            ><ChevronLeft className="h-4 w-4" /> Sebelum</button>
            <span className="px-2 tabular-nums">{safePage + 1} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >Seterus <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
