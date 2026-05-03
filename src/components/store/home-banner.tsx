'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Zap, ArrowRight } from 'lucide-react'

interface Banner {
  title: string
  subtitle: string | null
  link: string | null
  link_label: string | null
  bg_class: string
  image_url: string | null
}

interface FlashSale {
  label: string
  endsAt: string
  promoCode?: string
}

function useCountdown(endsAt: string) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, expired: false })
  useEffect(() => {
    function calc() {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft({ h: 0, m: 0, s: 0, expired: true }); return }
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        expired: false,
      })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [endsAt])
  return timeLeft
}

function CountdownStrip({ flashSale }: { flashSale: FlashSale }) {
  const { h, m, s, expired } = useCountdown(flashSale.endsAt)
  if (expired) return null

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-black/30 backdrop-blur-sm border-t border-white/10">
      <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
        <Zap className="h-3.5 w-3.5 text-white fill-white" />
      </div>
      <p className="text-white text-xs font-bold flex-1 truncate">{flashSale.label}</p>
      <div className="flex items-center gap-1 shrink-0">
        {[{ v: h, l: 'J' }, { v: m, l: 'M' }, { v: s, l: 'S' }].map(({ v, l }, i) => (
          <span key={l} className="flex items-center gap-1">
            {i > 0 && <span className="text-white/50 font-black text-xs">:</span>}
            <span className="flex flex-col items-center">
              <span className="bg-white/20 rounded px-1.5 py-0.5 text-xs font-black text-white tabular-nums">
                {pad(v)}
              </span>
              <span className="text-[8px] text-white/50 font-medium mt-0.5">{l}</span>
            </span>
          </span>
        ))}
      </div>
      {flashSale.promoCode && (
        <span className="text-[10px] font-black text-white bg-white/20 px-2 py-0.5 rounded-full ml-1 shrink-0">
          {flashSale.promoCode}
        </span>
      )}
    </div>
  )
}

export function HomeBanner({ banner, flashSale }: { banner: Banner | null; flashSale: FlashSale | null }) {
  if (!banner && !flashSale) return null

  // Flash sale only — no banner
  if (!banner && flashSale) {
    return (
      <Link href="/products" className="block mx-4 mt-4">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl overflow-hidden shadow-lg shadow-red-500/30 active:scale-[0.98] transition-transform">
          <CountdownStrip flashSale={flashSale} />
        </div>
      </Link>
    )
  }

  if (!banner) return null

  const content = (
    <div className="mx-4 mt-4 rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform">
      {/* Image or colour background */}
      {banner.image_url ? (
        <div className="relative">
          <Image
            src={banner.image_url}
            alt={banner.title}
            width={800}
            height={360}
            className="w-full object-cover max-h-52"
            priority
          />
          {/* Gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wide">Promosi Minggu Ini</p>
            <h2 className="text-lg font-bold text-white leading-tight">{banner.title}</h2>
            {banner.subtitle && <p className="text-sm text-white/80 mt-0.5">{banner.subtitle}</p>}
            <div className="inline-flex items-center gap-1 mt-2 bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full">
              {banner.link_label ?? 'Beli Sekarang'}
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      ) : (
        <div className={`${banner.bg_class} p-5 text-white`}>
          <p className="text-[10px] font-semibold opacity-80 uppercase tracking-wide">Promosi Minggu Ini</p>
          <h2 className="text-xl font-bold mt-1">{banner.title}</h2>
          {banner.subtitle && <p className="text-sm opacity-90 mt-1">{banner.subtitle}</p>}
          <div className="inline-flex items-center gap-1 mt-3 bg-white text-brand-red-600 text-sm font-semibold px-4 py-2 rounded-full">
            {banner.link_label ?? 'Beli Sekarang'}
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      )}

      {/* Flash sale countdown strip */}
      {flashSale && (
        <div className={banner.image_url ? '' : 'bg-black/20'}>
          <CountdownStrip flashSale={flashSale} />
        </div>
      )}
    </div>
  )

  return banner.link ? (
    <Link href={banner.link} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}
