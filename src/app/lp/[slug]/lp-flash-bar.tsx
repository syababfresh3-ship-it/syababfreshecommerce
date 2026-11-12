'use client'

// Bar tawaran masa terhad LP (migration 159) — muat keadaan dari /api/lp/[slug]/flash (set cookie masa
// mula untuk mod visitor), papar countdown; tamat → bar hilang senyap & semua checkout kembali harga asal
// (stor lib/stores/lp-flash.ts dikongsi). Copy JUJUR: "untuk anda · sekali setiap N jam" (bukan "flash
// sale untuk semua") — lihat lib/lp-flash.ts.
import { useEffect, useState } from 'react'
import { Gift, Timer } from 'lucide-react'
import { useLpFlash } from '@/lib/stores/lp-flash'
import { flashLabel } from '@/lib/lp-flash'

const pad = (n: number) => String(n).padStart(2, '0')
function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function LpFlashBar({ slug, fixed = false }: { slug: string; fixed?: boolean }) {
  const { load, offer, state, expire } = useLpFlash()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { load(slug) }, [slug, load])
  useEffect(() => {
    if (!state?.active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [state?.active])
  useEffect(() => {
    if (state?.active && state.endsAt != null && now >= state.endsAt) expire()
  }, [now, state, expire])

  if (!offer || !state?.active) return null
  const label = flashLabel({ ...offer, enabled: true, starts_at: null, ends_at: null })
  const remain = state.endsAt != null ? state.endsAt - now : null
  const visitor = offer.mode === 'visitor'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="lp-flash-bar"
      className={`${fixed ? 'fixed top-0 inset-x-0' : 'sticky top-0'} z-50 bg-[#E11D2A] text-white shadow-[0_4px_16px_rgba(225,29,42,0.35)]`}
    >
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-[13px] font-bold leading-tight">
        <Gift className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          {label}{visitor ? ' untuk anda' : ''}
          {offer.min_subtotal != null ? ` (min RM${offer.min_subtotal})` : ''}
        </span>
        {remain != null && (
          <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2 py-0.5 tabular-nums">
            <Timer className="h-3.5 w-3.5" aria-hidden />{visitor ? 'tamat dalam' : 'tamat'} {fmt(remain)}
          </span>
        )}
        {visitor && <span className="hidden sm:inline text-white/75 font-semibold">· sekali setiap {offer.cooldown_hours} jam</span>}
      </div>
    </div>
  )
}
