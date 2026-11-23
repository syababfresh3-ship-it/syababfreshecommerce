'use client'

// Tangkap pautan affiliate ?aff=KOD di MANA-MANA laluan (dipasang sekali di root layout).
// Skop ikut laluan (produk / LP / seluruh kedai) — lihat lib/affiliate-attribution.ts.
// Klik dilaporkan ke /api/affiliate/click supaya tetingkap masa & kiraan klik ikut pelayan.
// Guna window.location untuk query (bukan useSearchParams) → tiada keperluan Suspense.
// Migration 139 + 165.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { captureAff, scopeFor, setClickId } from '@/lib/affiliate-attribution'

export function AffiliateCapture() {
  const pathname = usePathname()
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get('aff')
      if (!code) return
      const scope = scopeFor(pathname || window.location.pathname)
      const scopes = scope === '*' ? ['*'] : [scope, '*']
      const entry = captureAff(scopes, code)
      if (!entry) return

      // Satu laporan per kod+skop setiap 10 minit dari tab ini (refresh tak digandakan;
      // pelayan juga nyahgandakan ikut IP).
      const dedupeKey = `sf_aff_c:${entry.code}:${scope}`
      try {
        const last = Number(sessionStorage.getItem(dedupeKey) || 0)
        if (Date.now() - last < 10 * 60_000) return
        sessionStorage.setItem(dedupeKey, String(Date.now()))
      } catch { /* abaikan */ }

      fetch('/api/affiliate/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: entry.code, scope, path: (pathname || window.location.pathname).slice(0, 200) }),
        keepalive: true,
      })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d?.id) setClickId(scopes, entry.code, String(d.id)) })
        .catch(() => {})
    } catch { /* abaikan */ }
  }, [pathname])
  return null
}
