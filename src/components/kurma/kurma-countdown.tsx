'use client'

// Countdown sedar-HARI untuk urgency (cth tempah sebelum Ramadan 1448H).
// Deadline jauh (hari) → tunjuk Hari + Jam sahaja & tick SEMINIT — saat berdetik untuk
// 100+ hari nampak palsu & buang render. Minit hanya bila < 3 hari, Saat bila < 1 hari.
// Tarikh akhir dipapar jelas supaya urgency konkrit, bukan kabur.
import { useEffect, useState } from 'react'

export function KurmaCountdown({ deadline, label }: { deadline: string; label: string }) {
  const [t, setT] = useState<{ d: number; h: number; m: number; s: number } | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const end = new Date(deadline).getTime()
    if (Number.isNaN(end)) return
    let id: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      const diff = end - Date.now()
      if (diff <= 0) { setExpired(true); setT(null); if (id) clearInterval(id); return }
      setT({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor(diff / 3_600_000) % 24,
        m: Math.floor(diff / 60_000) % 60,
        s: Math.floor(diff / 1_000) % 60,
      })
    }
    tick()
    // >= 1 hari → seminit sudah cukup tepat (jimat render); < 1 hari → sesaat.
    const period = end - Date.now() >= 86_400_000 ? 60_000 : 1_000
    id = setInterval(tick, period)
    return () => { if (id) clearInterval(id) }
  }, [deadline])

  if (expired || !t) return null

  const showMin = t.d < 3
  const showSec = t.d < 1
  const dateStr = new Date(deadline).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })

  const cell = (v: number, u: string) => (
    <div key={u} className="flex flex-col items-center">
      <div className="min-w-[50px] rounded-lg bg-white/15 px-2 py-1.5 text-2xl font-black tabular-nums">{String(v).padStart(2, '0')}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/70 mt-1">{u}</div>
    </div>
  )

  return (
    <div className="rounded-2xl px-5 py-4 text-white text-center" style={{ background: '#E11D2A' }}>
      <div className="text-[13px] font-bold">{label}</div>
      <div className="flex items-center justify-center gap-2 mt-2">
        {cell(t.d, 'Hari')}{cell(t.h, 'Jam')}{showMin && cell(t.m, 'Minit')}{showSec && cell(t.s, 'Saat')}
      </div>
      <div className="text-[11px] text-white/80 mt-2">Tarikh akhir tempahan: {dateStr}</div>
    </div>
  )
}
