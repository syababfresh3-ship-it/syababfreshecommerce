'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePosSession } from '@/lib/stores/pos-session'

// Muat /api/pos/me sekali bila POS dibuka: kasyer semasa (kuki PIN), register, kasyer untuk pad PIN,
// tetapan. Auto-pilih register kalau hanya satu. Jejak status online untuk lencana header.

export function usePosBootstrap() {
  const s = usePosSession()
  const [loading, setLoading] = useState(!s.booted)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/me', { cache: 'no-store' })
      if (res.status === 401) { window.location.href = `/pos/login?redirect=${encodeURIComponent(window.location.pathname)}`; return }
      if (res.status === 403) { window.location.href = '/pos/login?error=no_access'; return }
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Failed to load POS session')
      s.setRegisters(j.registers ?? [])
      s.setCashiers(j.cashiers ?? [])
      s.setCashier(j.cashier ?? null)
      s.setIsAdmin(!!j.isAdmin)
      s.setSettings(j.settings ?? null)
      s.setFlags({ migrationOk: j.migrationOk !== false, pinEnabled: j.pinEnabled !== false, booted: true })
      const regs = (j.registers ?? []) as { id: string; code: string; name: string }[]
      const current = usePosSession.getState().registerId
      if (regs.length > 0 && (!current || !regs.some(r => r.id === current))) s.setRegister(regs.length === 1 ? regs[0] : null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    const on = () => s.setOnline(true), off = () => s.setOnline(false)
    s.setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { loading, error, reload }
}
