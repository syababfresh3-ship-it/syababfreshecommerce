'use client'

import { useEffect } from 'react'

// Cetak automatik bila page resit dibuka dengan ?print= (window.open dari paparan berjaya).
export function AutoPrint({ delayMs = 350 }: { delayMs?: number }) {
  useEffect(() => {
    const t = setTimeout(() => { try { window.print() } catch { /* abaikan */ } }, delayMs)
    return () => clearTimeout(t)
  }, [delayMs])
  return null
}
