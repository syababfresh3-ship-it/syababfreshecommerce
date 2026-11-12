// ============================================================
// lp-flash — Tawaran masa terhad per landing page (migration 159). PURE: dikongsi klien & pelayan.
//
// Mod A 'visitor'   : timer bermula bila pelawat buka LP (cookie HMAC diset /api/lp/[slug]/flash),
//                     tamat selepas window_minutes, boleh dapat semula selepas cooldown_hours.
// Mod B 'scheduled' : satu tetingkap masa untuk semua (starts_at–ends_at), gaya flash sale Shopee.
//
// Kuat kuasa SEBENAR ada di /api/lp/[slug]/order (lib/lp-flash-server.ts): klien hanya papar.
// Tak boleh digabung dengan kod promo (keputusan pemilik 12 Nov 2026) — kod promo menang.
// ============================================================

export type FlashMode = 'visitor' | 'scheduled'
export type FlashDiscountType = 'fixed' | 'percent'
/** Mod visitor: timer bermula bila buka page ('visit') atau bila pelawat tekan "Tuntut" ('claim', gaya baucar TikTok). */
export type FlashStart = 'visit' | 'claim'

export interface FlashOffer {
  enabled: boolean
  mode: FlashMode
  start: FlashStart
  discount_type: FlashDiscountType
  /** RM (fixed) atau % (percent). */
  amount: number
  /** Mod visitor: tempoh timer (minit) & tempoh sebelum pelawat sama layak semula (jam). */
  window_minutes: number
  cooldown_hours: number
  /** Mod scheduled: ISO datetime (null = tiada had pada hujung itu). */
  starts_at: string | null
  ends_at: string | null
  /** Subtotal minimum untuk layak (null = tiada). */
  min_subtotal: number | null
  /** Teks pendek pada bar (kosong → auto "RM5 OFF" / "10% OFF"). */
  label: string
}

export const DEFAULT_FLASH_OFFER: FlashOffer = {
  enabled: false, mode: 'visitor', start: 'visit', discount_type: 'fixed', amount: 5,
  window_minutes: 15, cooldown_hours: 48, starts_at: null, ends_at: null, min_subtotal: null, label: '',
}

export type FlashReason = 'off' | 'not_started' | 'expired' | 'ended' | 'claimed' | 'active'
export interface FlashState {
  active: boolean
  /** ms epoch bila tawaran tamat (untuk countdown); null bila tiada. */
  endsAt: number | null
  /** ms epoch bila bermula (scheduled & belum mula). */
  startsAt: number | null
  reason: FlashReason
}

const r2 = (n: number) => Math.round(n * 100) / 100
const num = (v: unknown, min: number, max: number, dflt: number) => {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt
}
const iso = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** JSON DB/borang admin → FlashOffer sah (had munasabah). null/bukan objek → null (= tiada tawaran). */
export function normalizeFlashOffer(raw: unknown): FlashOffer | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const mode: FlashMode = o.mode === 'scheduled' ? 'scheduled' : 'visitor'
  const discount_type: FlashDiscountType = o.discount_type === 'percent' ? 'percent' : 'fixed'
  const minSub = o.min_subtotal == null || o.min_subtotal === '' ? null : num(o.min_subtotal, 0, 100_000, 0)
  return {
    enabled: o.enabled === true || o.enabled === 'true',
    mode,
    start: o.start === 'claim' ? 'claim' : 'visit',
    discount_type,
    amount: discount_type === 'percent' ? num(o.amount, 1, 90, 10) : num(o.amount, 0.5, 1000, 5),
    window_minutes: Math.round(num(o.window_minutes, 1, 24 * 60, 15)),
    cooldown_hours: Math.round(num(o.cooldown_hours, 1, 24 * 90, 48)),
    starts_at: iso(o.starts_at),
    ends_at: iso(o.ends_at),
    min_subtotal: minSub && minSub > 0 ? r2(minSub) : null,
    label: typeof o.label === 'string' ? o.label.trim().slice(0, 60) : '',
  }
}

/** Teks ringkas tawaran: label admin, atau auto "RM5 OFF" / "10% OFF". */
export function flashLabel(offer: FlashOffer): string {
  if (offer.label) return offer.label
  return offer.discount_type === 'percent' ? `${offer.amount}% OFF` : `RM${offer.amount % 1 ? offer.amount.toFixed(2) : offer.amount} OFF`
}

/** Diskaun untuk subtotal ini (0 bila bawah minimum). Fixed tak melebihi subtotal. */
export function flashDiscountFor(offer: FlashOffer, subtotal: number): number {
  const sub = Number(subtotal) || 0
  if (sub <= 0) return 0
  if (offer.min_subtotal != null && sub < offer.min_subtotal) return 0
  const d = offer.discount_type === 'percent' ? sub * offer.amount / 100 : offer.amount
  return r2(Math.max(0, Math.min(d, sub)))
}

/** Keadaan tawaran pada masa `now`. Mod visitor perlukan `startedAt` (ms, dari cookie yang disahkan). */
export function flashWindow(offer: FlashOffer, ctx: { startedAt?: number | null; now?: number }): FlashState {
  const now = ctx.now ?? Date.now()
  if (!offer.enabled) return { active: false, endsAt: null, startsAt: null, reason: 'off' }
  if (offer.mode === 'scheduled') {
    const s = offer.starts_at ? Date.parse(offer.starts_at) : null
    const e = offer.ends_at ? Date.parse(offer.ends_at) : null
    if (s != null && now < s) return { active: false, endsAt: e, startsAt: s, reason: 'not_started' }
    if (e != null && now >= e) return { active: false, endsAt: e, startsAt: s, reason: 'ended' }
    return { active: true, endsAt: e, startsAt: s, reason: 'active' }
  }
  const startedAt = ctx.startedAt ?? null
  if (startedAt == null) return { active: false, endsAt: null, startsAt: null, reason: 'not_started' }
  const endsAt = startedAt + offer.window_minutes * 60_000
  if (now >= endsAt) return { active: false, endsAt, startsAt: startedAt, reason: 'expired' }
  return { active: true, endsAt, startsAt: startedAt, reason: 'active' }
}

/** Nama cookie token masa mula (mod visitor) — per LP. */
export const flashCookieName = (slug: string) => `sf_flash_${slug.replace(/[^a-z0-9-]/gi, '')}`

/** Mesej jujur bila pelayan tolak diskaun yang klien jangka. */
export function flashRejectMessage(reason: FlashReason): string {
  switch (reason) {
    case 'claimed': return 'Tawaran masa terhad sudah digunakan untuk nombor telefon ini. Harga asal dikenakan.'
    case 'expired': return 'Masa tawaran anda sudah tamat. Harga asal dikenakan.'
    case 'ended': return 'Flash sale sudah tamat. Harga asal dikenakan.'
    case 'not_started': return 'Tawaran belum bermula. Harga asal dikenakan.'
    default: return 'Tawaran masa terhad tidak tersedia. Harga asal dikenakan.'
  }
}

/** Bidang yang selamat dihantar ke pelayar (tiada rahsia pun, tapi kekal minimum). */
export function publicFlashOffer(offer: FlashOffer) {
  return {
    mode: offer.mode, start: offer.start, discount_type: offer.discount_type, amount: offer.amount,
    window_minutes: offer.window_minutes, cooldown_hours: offer.cooldown_hours,
    min_subtotal: offer.min_subtotal, label: offer.label,
  }
}
