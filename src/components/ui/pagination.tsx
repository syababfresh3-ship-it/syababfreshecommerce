import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Sebelum
        </Link>
      ) : (
        <span className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-100 text-sm font-medium text-gray-300 cursor-not-allowed">
          <ChevronLeft className="h-4 w-4" />
          Sebelum
        </span>
      )}

      <span className="text-sm text-gray-500">
        {page} / {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={buildHref(page + 1)}
          className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Seterus
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex items-center gap-1 px-3 py-2 rounded-xl border border-gray-100 text-sm font-medium text-gray-300 cursor-not-allowed">
          Seterus
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </div>
  )
}
