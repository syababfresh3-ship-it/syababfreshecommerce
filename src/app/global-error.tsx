'use client'

// Boundary paling luar — ganti root layout bila layout.tsx sendiri gagal.
// Mesti ada <html><body> sendiri; globals.css/Tailwind mungkin tak dimuat →
// gaya inline sahaja. Monokrom, minimum.

import { useEffect } from 'react'
import { reportClientError } from '@/lib/report-client-error'

const S = {
  body: { margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', color: '#111827', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '24px' } as const,
  card: { maxWidth: 400, width: '100%', textAlign: 'center' as const },
  icon: { width: 40, height: 40, margin: '0 auto 16px', display: 'block', color: '#374151' },
  h1: { fontSize: 20, fontWeight: 700, margin: '0 0 8px' },
  p: { fontSize: 14, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 },
  row: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' as const },
  primary: { background: '#111827', color: '#fff', border: 0, borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  secondary: { background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' },
  digest: { marginTop: 20, fontSize: 11, color: '#9ca3af', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportClientError(error, 'global')
  }, [error])

  return (
    <html lang="ms">
      <body style={S.body}>
        <div style={S.card}>
          <svg style={S.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <h1 style={S.h1}>Ada ralat berlaku</h1>
          <p style={S.p}>Halaman tidak dapat dipaparkan. Cuba lagi, atau kembali ke laman utama.</p>
          <div style={S.row}>
            <button type="button" onClick={() => reset()} style={S.primary}>Cuba lagi</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- root layout dah gagal; muat semula penuh lebih selamat daripada navigasi client */}
            <a href="/" style={S.secondary}>Laman utama</a>
          </div>
          {error.digest && <p style={S.digest}>Kod ralat: {error.digest}</p>}
        </div>
      </body>
    </html>
  )
}
