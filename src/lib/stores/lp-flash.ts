import { create } from 'zustand'
import { flashDiscountFor, type FlashOffer, type FlashReason, type FlashState } from '@/lib/lp-flash'

// Keadaan tawaran masa terhad LP di pelayar — SATU sumber untuk bar (LpFlashBar), paparan harga
// (LpFlashPrice / useFlashDiscount) dan ketiga-tiga komponen checkout (multi / inline / cart bar).
// Dimuat sekali per slug dari POST /api/lp/[slug]/flash (mod visitor 'visit': set cookie masa mula;
// 'claim': timer bermula hanya bila claim() dipanggil). Pelayan tetap kira semula & boleh tolak
// (409 + flash_reason) → setInactive(reason).

export type PublicFlashOffer = Pick<FlashOffer, 'mode' | 'start' | 'discount_type' | 'amount' | 'window_minutes' | 'cooldown_hours' | 'min_subtotal' | 'label'>

interface LpFlashStore {
  slug: string | null
  loaded: boolean
  offer: PublicFlashOffer | null
  state: FlashState | null
  /** start 'claim' & belum tuntut → bar papar butang "Tuntut". */
  claimable: boolean
  claiming: boolean
  load: (slug: string) => Promise<void>
  /** Pelawat tekan "Tuntut" (start 'claim') → POST ?claim=1 → cookie masa mula → countdown. */
  claim: () => Promise<void>
  /** Timer tamat di pelayar → harga asal serta-merta (pelayan pun akan tolak). */
  expire: () => void
  /** Pelayan tolak dengan sebab (claimed/expired/ended) → padamkan diskaun di UI. */
  setInactive: (reason: FlashReason) => void
}

async function fetchState(slug: string, claim: boolean) {
  const r = await fetch(`/api/lp/${encodeURIComponent(slug)}/flash${claim ? '?claim=1' : ''}`, { method: 'POST', cache: 'no-store' })
  return r.ok ? r.json() : null
}

export const useLpFlash = create<LpFlashStore>((set, get) => ({
  slug: null, loaded: false, offer: null, state: null, claimable: false, claiming: false,
  load: async (slug) => {
    if (get().slug === slug && get().loaded) return
    set({ slug })
    try {
      const j = await fetchState(slug, false)
      if (get().slug !== slug) return
      if (!j?.enabled) { set({ loaded: true, offer: null, state: null, claimable: false }); return }
      set({ loaded: true, offer: j.offer as PublicFlashOffer, state: j.state as FlashState, claimable: !!j.claimable })
    } catch { set({ loaded: true, offer: null, state: null, claimable: false }) }
  },
  claim: async () => {
    const slug = get().slug
    if (!slug || get().claiming) return
    set({ claiming: true })
    try {
      const j = await fetchState(slug, true)
      if (j?.enabled) set({ offer: j.offer as PublicFlashOffer, state: j.state as FlashState, claimable: !!j.claimable })
    } finally { set({ claiming: false }) }
  },
  expire: () => set(s => (s.state?.active ? { state: { ...s.state, active: false, reason: s.offer?.mode === 'scheduled' ? 'ended' : 'expired' } } : {})),
  setInactive: (reason) => set(s => ({ claimable: false, state: s.state ? { ...s.state, active: false, reason } : { active: false, endsAt: null, startsAt: null, reason } })),
}))

/** Diskaun flash yang patut dipapar untuk subtotal ini (0 bila tak aktif / ada kod promo). */
export function flashDiscountNow(s: Pick<LpFlashStore, 'offer' | 'state'>, subtotal: number, hasPromo: boolean): number {
  if (!s.offer || !s.state?.active || hasPromo) return 0
  // offer awam tiada enabled/starts/ends — bentuk FlashOffer penuh diperlukan oleh flashDiscountFor (hanya guna amount/type/min)
  return flashDiscountFor({ ...s.offer, enabled: true, starts_at: null, ends_at: null }, subtotal)
}

/** Hook ringkas untuk paparan harga: diskaun & harga akhir bagi satu jumlah (cth harga × qty). */
export function useFlashDiscount(amount: number, hasPromo = false): { discount: number; final: number; active: boolean } {
  const offer = useLpFlash(s => s.offer)
  const state = useLpFlash(s => s.state)
  const discount = flashDiscountNow({ offer, state }, amount, hasPromo)
  return { discount, final: Math.max(0, amount - discount), active: discount > 0 }
}
