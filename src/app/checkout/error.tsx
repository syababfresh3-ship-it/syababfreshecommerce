'use client'

// Boundary checkout — ralat di sini = jualan hilang. Beri jalan keluar jelas:
// cuba lagi, WhatsApp CS (dengan kod ralat), atau balik ke troli (troli
// disimpan dalam localStorage, tak hilang).

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, MessageCircle, ShoppingCart } from 'lucide-react'
import { humanWaUrl } from '@/lib/support/constants'
import { reportClientError } from '@/lib/report-client-error'

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, 'checkout')
  }, [error])

  const waHref = humanWaUrl(
    `Hai SyababFresh, saya tak dapat buat checkout di website.${error.digest ? ` Kod ralat: ${error.digest}` : ''}`,
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-gray-700" strokeWidth={1.75} />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Checkout terganggu</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Ada ralat semasa memproses. Troli anda masih disimpan — cuba lagi, atau hubungi kami dan kami bantu siapkan pesanan.
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
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 font-semibold px-5 py-2.5 rounded-2xl text-sm hover:bg-gray-50 transition-colors"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={2} />
          WhatsApp kami
        </a>
        <Link
          href="/cart"
          className="inline-flex items-center justify-center gap-2 border border-gray-200 bg-white text-gray-700 font-semibold px-5 py-2.5 rounded-2xl text-sm hover:bg-gray-50 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" strokeWidth={2} />
          Ke troli
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-[11px] text-gray-400 font-mono">Kod ralat: {error.digest}</p>
      )}
    </div>
  )
}
