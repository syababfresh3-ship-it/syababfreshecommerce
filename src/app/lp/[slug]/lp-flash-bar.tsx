'use client'

// Bar tawaran masa terhad LP (migration 159) — muat keadaan dari /api/lp/[slug]/flash (set cookie masa
// mula untuk mod visitor), papar countdown besar; tamat → bar hilang senyap & semua checkout kembali
// harga asal (stor lib/stores/lp-flash.ts dikongsi). Copy JUJUR: "untuk anda · sekali setiap N jam".
//
// Kedudukan (pemilik 12 Nov 2026: "letak kat footer, besarkan"): classic = melekat BAWAH skrin, besar;
// template live = atas (kawalan beli template itu di bawah). Tinggi bar didedahkan sebagai CSS var
// --lp-flash-h pada <html> supaya bar troli terapung (LpCartBar, fixed bottom-4) naik ke atasnya dan
// kandungan page dapat margin bawah — tiada yang tertutup.
import { useEffect, useRef, useState } from 'react'
import { Gift, Timer } from 'lucide-react'
import { useLpFlash } from '@/lib/stores/lp-flash'
import { flashLabel } from '@/lib/lp-flash'

const pad = (n: number) => String(n).padStart(2, '0')
function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
const setFlashHeight = (px: number) => {
  if (typeof document === 'undefined') return
  if (px > 0) document.documentElement.style.setProperty('--lp-flash-h', `${px}px`)
  else document.documentElement.style.removeProperty('--lp-flash-h')
}

export function LpFlashBar({ slug, position = 'bottom' }: { slug: string; position?: 'top' | 'bottom' }) {
  const { load, offer, state, expire, claimable, claiming, claim } = useLpFlash()
  const [now, setNow] = useState(() => Date.now())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { load(slug) }, [slug, load])
  useEffect(() => {
    if (!state?.active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [state?.active])
  useEffect(() => {
    if (state?.active && state.endsAt != null && now >= state.endsAt) expire()
  }, [now, state, expire])

  // Dedah tinggi bar bawah kepada CSS (bar troli & margin page); kosongkan bila bar hilang.
  // Bar juga nampak dalam keadaan "boleh tuntut" (start 'claim', belum tekan Tuntut).
  const visible = !!offer && (!!state?.active || claimable)
  useEffect(() => {
    if (!visible || position !== 'bottom') { setFlashHeight(0); return }
    const el = ref.current
    if (!el) return
    const update = () => setFlashHeight(el.offsetHeight)
    update()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => { ro?.disconnect(); setFlashHeight(0) }
  }, [visible, position])

  if (!visible || !offer) return null
  const label = flashLabel({ ...offer, enabled: true, starts_at: null, ends_at: null })
  const visitor = offer.mode === 'visitor'
  const minTxt = offer.min_subtotal != null ? ` · min RM${offer.min_subtotal}` : ''

  // Keadaan "Tuntut" (start 'claim'): timer belum bermula — pelawat tekan butang, baru countdown (gaya baucar TikTok)
  if (!state?.active && claimable) {
    return (
      <div
        ref={ref}
        role="region"
        aria-label="Tawaran masa terhad"
        data-testid="lp-flash-bar"
        className={`${position === 'bottom' ? 'fixed bottom-0 inset-x-0 pb-[env(safe-area-inset-bottom)]' : 'fixed top-0 inset-x-0'} z-[45] bg-[#E11D2A] text-white shadow-[0_-6px_24px_rgba(225,29,42,0.35)]`}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-10 w-10 shrink-0 grid place-items-center rounded-full bg-white/15"><Gift className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0">
              <div className="text-[16px] font-extrabold leading-tight truncate">{label} untuk anda</div>
              <div className="text-[12px] font-semibold text-white/80 truncate">Sah {offer.window_minutes} minit selepas tuntut · sekali setiap {offer.cooldown_hours} jam{minTxt}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => claim()}
            disabled={claiming}
            className="shrink-0 inline-flex items-center gap-1.5 bg-white text-[#E11D2A] font-black text-[14px] rounded-xl px-4 py-2.5 shadow active:scale-95 transition disabled:opacity-60"
          >
            <Timer className="h-4 w-4" aria-hidden />{claiming ? '…' : 'Tuntut'}
          </button>
        </div>
      </div>
    )
  }
  if (!state?.active) return null
  const remain = state.endsAt != null ? state.endsAt - now : null
  const sub = (visitor ? `Sekali setiap ${offer.cooldown_hours} jam` : 'Flash sale') + minTxt

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      data-testid="lp-flash-bar"
      className={`${position === 'bottom' ? 'fixed bottom-0 inset-x-0 pb-[env(safe-area-inset-bottom)]' : 'fixed top-0 inset-x-0'} z-[45] bg-[#E11D2A] text-white shadow-[0_-6px_24px_rgba(225,29,42,0.35)]`}
    >
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-10 w-10 shrink-0 grid place-items-center rounded-full bg-white/15"><Gift className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <div className="text-[16px] font-extrabold leading-tight truncate">{label}{visitor ? ' untuk anda' : ''}</div>
            <div className="text-[12px] font-semibold text-white/80 truncate">{sub}</div>
          </div>
        </div>
        {remain != null && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/80 inline-flex items-center gap-1"><Timer className="h-3 w-3" aria-hidden />{visitor ? 'Tamat dalam' : 'Tamat'}</div>
            <div className="text-[26px] font-black tabular-nums leading-none">{fmt(remain)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
