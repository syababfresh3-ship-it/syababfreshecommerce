'use client'

// Jadual dengan pagination tempatan (tanpa reload) untuk laporan — baris datang siap dirender
// dari server component (boleh ada StatusDropdown/PaymentDropdown di dalamnya).
// Kawalan muka surat muncul hanya bila baris melebihi pageSize.
import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function PagedTable({ head, rows, colSpan, pageSize = 15, empty }: {
  head: ReactNode
  rows: ReactNode[]
  colSpan: number
  pageSize?: number
  empty: string
}) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const cur = Math.min(page, pages - 1)
  const start = cur * pageSize
  const slice = rows.slice(start, start + pageSize)
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-500 text-xs">{head}</thead>
      <tbody className="divide-y divide-gray-50">
        {slice}
        {rows.length === 0 && <tr><td colSpan={colSpan} className="px-3 py-6 text-center text-gray-400">{empty}</td></tr>}
      </tbody>
      {rows.length > pageSize && (
        <tfoot>
          <tr>
            <td colSpan={colSpan} className="px-3 py-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{start + 1}–{Math.min(start + pageSize, rows.length)} daripada {rows.length}</span>
                <span className="inline-flex items-center gap-1">
                  <button type="button" onClick={() => setPage(Math.max(0, cur - 1))} disabled={cur === 0}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40" aria-label="Sebelum">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-1 tabular-nums">{cur + 1} / {pages}</span>
                  <button type="button" onClick={() => setPage(Math.min(pages - 1, cur + 1))} disabled={cur >= pages - 1}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40" aria-label="Seterusnya">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}
