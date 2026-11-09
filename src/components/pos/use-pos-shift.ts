'use client'

import { useCallback, useEffect } from 'react'
import { usePosSession } from '@/lib/stores/pos-session'

// Status buka/tutup kedai untuk register peranti: /api/pos/shifts?register= → sesi (cip header + kunci skrin Sell).
// Dimuat semula bila register bertukar dan bila tab kembali aktif (peranti lain mungkin dah buka/tutup).

export function usePosShift() {
  const registerId = usePosSession(s => s.registerId)
  const setShift = usePosSession(s => s.setShift)

  const refresh = useCallback(async () => {
    if (!registerId) { setShift(null); return null }
    try {
      const res = await fetch(`/api/pos/shifts?register=${encodeURIComponent(registerId)}`, { cache: 'no-store' })
      if (!res.ok) return null
      const j = await res.json()
      setShift(j.shift ? { id: j.shift.id, opened_at: j.shift.opened_at, opening_float: Number(j.shift.opening_float), opened_by_name: j.shift.opener?.name ?? null } : null)
      return j
    } catch { return null }
  }, [registerId, setShift])

  useEffect(() => {
    refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return { refresh }
}
