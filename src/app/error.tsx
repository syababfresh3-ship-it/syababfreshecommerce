'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // error boundary — intentionally silent in production
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <p className="text-7xl mb-4">😕</p>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Oops! Ada ralat berlaku</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Sesuatu tidak kena. Cuba semula atau hubungi kami jika masalah berterusan.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-brand-red-600 text-white font-semibold px-5 py-2.5 rounded-2xl text-sm hover:bg-brand-red-700 transition-colors"
        >
          Cuba Semula
        </button>
        <a
          href="/"
          className="border border-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-2xl text-sm hover:bg-gray-50 transition-colors"
        >
          Laman Utama
        </a>
      </div>
    </div>
  )
}
