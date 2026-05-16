'use client'

import { useEffect, useState } from 'react'

export function LpCountdown({ endDatetime, title, expiredText }: {
  endDatetime: string
  title: string
  expiredText: string
}) {
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number } | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    function calc() {
      const diff = new Date(endDatetime).getTime() - Date.now()
      if (diff <= 0) { setExpired(true); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft({ h, m, s })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [endDatetime])

  if (expired) {
    return (
      <div className="my-4 bg-gray-100 rounded-2xl p-4 text-center">
        <p className="text-sm font-bold text-gray-500">{expiredText}</p>
      </div>
    )
  }

  if (!timeLeft) return null

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="my-4 bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
      <p className="text-xs font-bold text-red-700 mb-3 uppercase tracking-wide">{title}</p>
      <div className="flex items-center justify-center gap-2">
        {[{ val: timeLeft.h, label: 'JAM' }, { val: timeLeft.m, label: 'MINIT' }, { val: timeLeft.s, label: 'SAAT' }].map((unit, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="flex flex-col items-center">
              <span className="text-3xl font-black text-red-700 leading-none tabular-nums w-16 bg-white rounded-xl py-2 shadow-sm border border-red-100">
                {pad(unit.val)}
              </span>
              <span className="text-[9px] font-bold text-red-400 mt-1">{unit.label}</span>
            </span>
            {i < 2 && <span className="text-2xl font-black text-red-400 mb-4">:</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
