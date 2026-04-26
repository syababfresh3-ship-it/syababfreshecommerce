import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  total: number
  pageSize: number
  basePath: string
  params?: Record<string, string>
}

export function Pagination({ page, total, pageSize, basePath, params = {} }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  function url(p: number) {
    const sp = new URLSearchParams({ ...params, page: p.toString() })
    return `${basePath}?${sp}`
  }

  // Show at most 5 page numbers centered around current page
  const start = Math.max(1, page - 2)
  const end   = Math.min(totalPages, start + 4)
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i)

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
      <span className="text-xs text-gray-500">
        {from}–{to} daripada <span className="font-semibold text-gray-700">{total}</span> rekod
      </span>

      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link href={url(page - 1)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors" aria-label="Sebelum">
            <ChevronLeft className="h-4 w-4 text-gray-500" />
          </Link>
        ) : (
          <span className="p-1.5 opacity-30 cursor-not-allowed">
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          </span>
        )}

        {start > 1 && (
          <>
            <Link href={url(1)} className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">1</Link>
            {start > 2 && <span className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>}
          </>
        )}

        {pages.map((p) => (
          <Link
            key={p}
            href={url(p)}
            className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
              p === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p}
          </Link>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>}
            <Link href={url(totalPages)} className="w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">{totalPages}</Link>
          </>
        )}

        {page < totalPages ? (
          <Link href={url(page + 1)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors" aria-label="Seterusnya">
            <ChevronRight className="h-4 w-4 text-gray-500" />
          </Link>
        ) : (
          <span className="p-1.5 opacity-30 cursor-not-allowed">
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </span>
        )}
      </div>
    </div>
  )
}
