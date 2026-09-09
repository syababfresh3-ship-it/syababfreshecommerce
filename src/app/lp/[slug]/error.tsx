'use client'

// Boundary landing page — trafik iklan; kalau LP rosak, pelawat mesti ada
// jalan terus ke WhatsApp CS untuk order manual (link page disertakan).

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, MessageCircle } from 'lucide-react'
import { humanWaUrl } from '@/lib/support/constants'
import { reportClientError } from '@/lib/report-client-error'

export default function LpError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, 'lp')
  }, [error])

  // Link page ditambah masa klik (window hanya ada di client; elak mismatch SSR).
  const waText = (pageUrl?: string) =>
    `Hai SyababFresh, saya nak order tapi page ada ralat.${pageUrl ? ` Link: ${pageUrl}` : ''}${error.digest ? ` (Kod: ${error.digest})` : ''}`
  const waHref = humanWaUrl(waText())
  const openWa = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    window.open(humanWaUrl(waText(window.location.href.split('?')[0])), '_blank', 'noopener')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-gray-700" strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Halaman tidak dapat dibuka</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Maaf, ada ralat sebentar. Cuba lagi, atau WhatsApp kami terus untuk buat pesanan.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold px-5 py-2.5 rounded-2xl text-sm hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2} />
          Cuba lagi
        </button>
        <a
          href={waHref}
          onClick={openWa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 font-semibold px-5 py-2.5 rounded-2xl text-sm hover:bg-gray-50 transition-colors"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={2} />
          Order via WhatsApp
        </a>
      </div>
      {error.digest && (
        <p className="mt-6 text-[11px] text-gray-400 font-mono">Kod ralat: {error.digest}</p>
      )}
    </div>
  )
}
