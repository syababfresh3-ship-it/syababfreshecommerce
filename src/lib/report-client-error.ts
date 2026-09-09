// Hantar ralat dari error boundary (client) ke /api/error-report.
// Fail-soft: tak pernah throw, tak tunggu jawapan. Guna sendBeacon (kekal
// walau tab ditutup) dengan fallback fetch keepalive. Dedup 5s — React
// StrictMode (dev) jalankan effect dua kali.

let lastKey = ''
let lastAt = 0

export function reportClientError(error: { message?: string; digest?: string } | null | undefined, source?: string): void {
  try {
    if (typeof window === 'undefined' || !error) return
    const msg = String(error.message ?? '').slice(0, 500)
    const message = source ? `[${source}] ${msg}` : msg
    const digest = error.digest ?? null
    const pathname = window.location.pathname.slice(0, 300)

    const key = `${digest ?? ''}|${message}|${pathname}`
    const now = Date.now()
    if (key === lastKey && now - lastAt < 5_000) return
    lastKey = key
    lastAt = now

    const payload = JSON.stringify({ message, digest, pathname, userAgent: navigator.userAgent.slice(0, 300) })
    const blob = new Blob([payload], { type: 'application/json' })
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/error-report', blob)) return
    fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* senyap — jangan tambah ralat atas ralat */
  }
}
