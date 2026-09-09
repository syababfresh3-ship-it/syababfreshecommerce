'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any

const PAGE_SIZE = 20

// Jadual "Kupon — ikut kod" — pagination + carian klien. Data (semua kod) dah
// dimuatkan server-side; di sini cuma potong ikut page & tapis ikut carian.
// Perlu sebab kod WL/KS (welcome voucher & kad setia) satu-per-pengguna → ratusan.
export function CouponCodesTable({ codes }: { codes: Row[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return codes
    return codes.filter((c: Row) => String(c.code).toUpperCase().includes(q))
  }, [codes, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const start = safePage * PAGE_SIZE
  const rows = filtered.slice(start, start + PAGE_SIZE)

  return (
    <div className="space-y-2">
      <div className="relative max-w-xs">
        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0) }}
          placeholder="Cari kod…"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr><th className="text-left px-4 py-2">Kod</th><th className="text-left px-4 py-2">Nilai</th><th className="text-right px-4 py-2">Kali diguna</th><th className="text-left px-4 py-2">Had</th><th className="text-left px-4 py-2">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((c: Row) => (
              <tr key={c.code}>
                <td className="px-4 py-2 font-mono font-semibold text-gray-800">{c.code}</td>
                <td className="px-4 py-2 text-gray-600">{c.type === 'percentage' ? `${c.value}%` : `RM${c.value}`}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">{c.uses_count}</td>
                <td className="px-4 py-2 text-gray-400">{c.max_uses ?? '∞'}</td>
                <td className="px-4 py-2">{c.active ? <span className="text-emerald-600 text-xs">Aktif</span> : <span className="text-gray-400 text-xs">Off</span>}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">{codes.length === 0 ? 'Tiada kod promo.' : 'Tiada kod sepadan carian.'}</td></tr>
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
