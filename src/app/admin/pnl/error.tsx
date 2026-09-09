'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'

// Sempadan ralat untuk laluan /admin/* (AdminShell kekal, hanya kandungan page
// diganti). Salinan fail sama diletak di admin/orders, admin/customers,
// admin/pnl supaya ralat page anak tidak buang keseluruhan /admin.
// `unstable_retry` (Next 16.2+) muat semula data segmen; `reset` fallback.
export default function AdminError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  unstable_retry?: () => void
}) {
  useEffect(() => {
    console.error('[admin] ralat page:', error)
  }, [error])

  const retry = () => (unstable_retry ?? reset)()

  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-lg">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-gray-700 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900">Ralat memuatkan halaman</h1>
            <p className="text-sm text-gray-500 mt-1">
              Sesuatu tidak kena semasa memuatkan halaman ini. Cuba lagi, atau kembali ke dashboard.
            </p>
            {error.digest && (
              <p className="mt-2 text-[11px] font-mono text-gray-400 break-all">digest: {error.digest}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />Cuba lagi
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center px-3.5 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                Kembali ke /admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
