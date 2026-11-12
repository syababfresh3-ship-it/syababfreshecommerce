import { create } from 'zustand'
import { flashDiscountFor, type FlashOffer, type FlashReason, type FlashState } from '@/lib/lp-flash'

// Keadaan tawaran masa terhad LP di pelayar — SATU sumber untuk bar terapung (LpFlashBar) dan
// ketiga-tiga komponen checkout (multi / inline / cart bar). Dimuat sekali per slug dari
// POST /api/lp/[slug]/flash (yang juga set cookie masa mula untuk mod visitor).
// Pelayan tetap kira semula & boleh tolak (409 + flash_reason) → setInactive(reason).

export type PublicFlashOffer = Pick<FlashOffer, 'mode' | 'discount_type' | 'amount' | 'window_minutes' | 'cooldown_hours' | 'min_subtotal' | 'label'>

interface LpFlashStore {
  slug: string | null
  loaded: boolean
  offer: PublicFlashOffer | null
  state: FlashState | null
  load: (slug: string) => Promise<void>
  /** Timer tamat di pelayar → harga asal serta-merta (pelayan pun akan tolak). */
  expire: () => void
  /** Pelayan tolak dengan sebab (claimed/expired/ended) → padamkan diskaun di UI. */
  setInactive: (reason: FlashReason) => void
}

export const useLpFlash = create<LpFlashStore>((set, get) => ({
  slug: null, loaded: false, offer: null, state: null,
  load: async (slug) => {
    if (get().slug === slug && get().loaded) return
    set({ slug })
    try {
      const r = await fetch(`/api/lp/${encodeURIComponent(slug)}/flash`, { method: 'POST', cache: 'no-store' })
      const j = r.ok ? await r.json() : null
      if (get().slug !== slug) return
      if (!j?.enabled) { set({ loaded: true, offer: null, state: null }); return }
      set({ loaded: true, offer: j.offer as PublicFlashOffer, state: j.state as FlashState })
    } catch { set({ loaded: true, offer: null, state: null }) }
  },
  expire: () => set(s => (s.state?.active ? { state: { ...s.state, active: false, reason: s.offer?.mode === 'scheduled' ? 'ended' : 'expired' } } : {})),
  setInactive: (reason) => set(s => ({ state: s.state ? { ...s.state, active: false, reason } : { active: false, endsAt: null, startsAt: null, reason } })),
}))

/** Diskaun flash yang patut dipapar untuk subtotal ini (0 bila tak aktif / ada kod promo). */
export function flashDiscountNow(s: Pick<LpFlashStore, 'offer' | 'state'>, subtotal: number, hasPromo: boolean): number {
  if (!s.offer || !s.state?.active || hasPromo) return 0
  // offer awam tiada enabled/starts/ends — bentuk FlashOffer penuh diperlukan oleh flashDiscountFor (hanya guna amount/type/min)
  return flashDiscountFor({ ...s.offer, enabled: true, starts_at: null, ends_at: null }, subtotal)
}
