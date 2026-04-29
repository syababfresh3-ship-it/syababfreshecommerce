'use client'

import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import Link from 'next/link'

function useCountdown(endsAt: string) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, expired: false })

  useEffect(() => {
    function calc() {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0, expired: true }); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft({ h, m, s, expired: false })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return timeLeft
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1 text-lg font-black text-white tabular-nums min-w-[2.2rem] text-center">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] text-white/60 font-medium mt-0.5">{label}</span>
    </div>
  )
}

export function FlashSaleBanner({ label, endsAt, promoCode }: { label: string; endsAt: string; promoCode?: string }) {
  const { h, m, s, expired } = useCountdown(endsAt)
  if (expired) return null

  return (
    <Link href="/products" className="block mx-4 mt-4">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-lg shadow-red-500/30 active:scale-[0.98] transition-transform">
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-white fill-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-sm leading-tight truncate">{label}</p>
          {promoCode && (
            <p className="text-white/70 text-[10px] font-medium mt-0.5">
              Kod: <span className="font-black text-white">{promoCode}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Digit value={h} label="JAM" />
          <span className="text-white/60 font-black mb-3">:</span>
          <Digit value={m} label="MIN" />
          <span className="text-white/60 font-black mb-3">:</span>
          <Digit value={s} label="SAAT" />
        </div>
      </div>
    </Link>
  )
}
