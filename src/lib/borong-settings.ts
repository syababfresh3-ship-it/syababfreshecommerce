import { BORONG_CATALOG, BORONG_DISCOUNT, BORONG_GROUPS, BORONG_TERMS, type BorongCatalogEntry, type BorongGroup, type BorongTerms } from '@/lib/borong-pricing'

// Tetapan harga & terma borong yang admin ubah di /admin/borong — SATU kunci app_settings `borong_pricing`
// (JSON). Nilai di sini MENIMPA nilai lalai dalam lib/borong-pricing.ts (fail kod kekal sebagai fallback:
// tier, stat, program ejen masih dari fail). null/'' = tak ditetapkan → guna lalai fail. Pure (klien + server).

export const BORONG_SETTINGS_KEY = 'borong_pricing'

export interface BorongSettingsTerms {
  moqCtn: number | null; mixAllowed: boolean | null; leadTime: string | null
  freeAboveRm: number | null; deliveryNote: string | null; pickup: boolean | null
  paymentMethods: string[]; creditNote: string | null; returnsNote: string | null
  sampleAvailable: boolean | null; sampleNote: string | null
  ramadan: { preorderOpen: string | null; preorderClose: string | null; priceLockNote: string | null; deliveryWindow: string | null }
}
export interface BorongSettings {
  /** 'YYYY-MM-DD' — ditetapkan auto bila harga disimpan. */
  updated: string | null
  defaultPct: number | null
  byGroup: Partial<Record<BorongGroup, number>>
  /** slug → RM/karton (hanya yang diisi). */
  prices: Record<string, number>
  terms: BorongSettingsTerms
}

export const EMPTY_BORONG_SETTINGS: BorongSettings = {
  updated: null, defaultPct: null, byGroup: {}, prices: {},
  terms: {
    moqCtn: null, mixAllowed: null, leadTime: null, freeAboveRm: null, deliveryNote: null, pickup: null,
    paymentMethods: [], creditNote: null, returnsNote: null, sampleAvailable: null, sampleNote: null,
    ramadan: { preorderOpen: null, preorderClose: null, priceLockNote: null, deliveryWindow: null },
  },
}

const SLUGS = new Set(BORONG_CATALOG.map(e => e.slug))
const GROUPS = new Set<string>(BORONG_GROUPS.map(g => g.id))
const num = (v: unknown, min = 0, max = 1_000_000): number | null => { const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v); return v == null || !Number.isFinite(n) || n < min || n > max ? null : n }
const str = (v: unknown, max: number): string | null => { if (typeof v !== 'string') return null; const s = v.trim().slice(0, max); return s || null }
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : null)

/** Toleran — JSON rosak/kosong → bentuk lengkap dengan null. */
export function parseBorongSettings(raw: string | null | undefined): BorongSettings {
  if (!raw) return structuredClone(EMPTY_BORONG_SETTINGS)
  try { return normalizeBorongSettings(JSON.parse(raw)) } catch { return structuredClone(EMPTY_BORONG_SETTINGS) }
}

/** Bersihkan input admin → bentuk sah (buang slug/kumpulan tak dikenali, had panjang, julat nombor). */
export function normalizeBorongSettings(input: unknown): BorongSettings {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const t = (i.terms && typeof i.terms === 'object' ? i.terms : {}) as Record<string, unknown>
  const r = (t.ramadan && typeof t.ramadan === 'object' ? t.ramadan : {}) as Record<string, unknown>
  const byGroup: Partial<Record<BorongGroup, number>> = {}
  for (const [g, v] of Object.entries((i.byGroup && typeof i.byGroup === 'object' ? i.byGroup : {}) as Record<string, unknown>)) {
    const n = num(v, 0, 95); if (GROUPS.has(g) && n != null) byGroup[g as BorongGroup] = n
  }
  const prices: Record<string, number> = {}
  for (const [slug, v] of Object.entries((i.prices && typeof i.prices === 'object' ? i.prices : {}) as Record<string, unknown>)) {
    const n = num(v, 0.01, 100_000); if (SLUGS.has(slug) && n != null) prices[slug] = Math.round(n * 100) / 100
  }
  const updated = str(i.updated, 10)
  return {
    updated: updated && /^\d{4}-\d{2}-\d{2}$/.test(updated) ? updated : null,
    defaultPct: num(i.defaultPct, 0, 95),
    byGroup, prices,
    terms: {
      moqCtn: (() => { const n = num(t.moqCtn, 1, 10_000); return n == null ? null : Math.floor(n) })(),
      mixAllowed: bool(t.mixAllowed), leadTime: str(t.leadTime, 160),
      freeAboveRm: num(t.freeAboveRm, 1, 1_000_000), deliveryNote: str(t.deliveryNote, 300), pickup: bool(t.pickup),
      paymentMethods: Array.isArray(t.paymentMethods) ? (t.paymentMethods as unknown[]).map(x => str(x, 40)).filter((x): x is string => !!x).slice(0, 10) : [],
      creditNote: str(t.creditNote, 300), returnsNote: str(t.returnsNote, 500),
      sampleAvailable: bool(t.sampleAvailable), sampleNote: str(t.sampleNote, 300),
      ramadan: { preorderOpen: str(r.preorderOpen, 60), preorderClose: str(r.preorderClose, 60), priceLockNote: str(r.priceLockNote, 300), deliveryWindow: str(r.deliveryWindow, 120) },
    },
  }
}

/** Terma berkesan untuk LP: tetapan admin menimpa fail (nilai null = kekal fail). */
export function effectiveTerms(s: BorongSettings): BorongTerms {
  const f = BORONG_TERMS, t = s.terms
  return {
    ...f,
    moqCtn: t.moqCtn ?? f.moqCtn,
    mixAllowed: t.mixAllowed ?? f.mixAllowed,
    leadTime: t.leadTime ?? f.leadTime,
    delivery: { freeAboveRm: t.freeAboveRm ?? f.delivery.freeAboveRm, note: t.deliveryNote ?? f.delivery.note, pickup: t.pickup ?? f.delivery.pickup },
    payment: { methods: t.paymentMethods.length ? t.paymentMethods : f.payment.methods, creditNote: t.creditNote ?? f.payment.creditNote },
    returns: { note: t.returnsNote ?? f.returns.note },
    sample: { available: t.sampleAvailable ?? f.sample.available, note: t.sampleNote ?? f.sample.note },
    ramadan: {
      preorderOpen: t.ramadan.preorderOpen ?? f.ramadan.preorderOpen, preorderClose: t.ramadan.preorderClose ?? f.ramadan.preorderClose,
      priceLockNote: t.ramadan.priceLockNote ?? f.ramadan.priceLockNote, deliveryWindow: t.ramadan.deliveryWindow ?? f.ramadan.deliveryWindow,
    },
  }
}

/** Harga borong/karton: tetapan admin (RM) > fail (refPriceCtn) > % admin (kumpulan > lalai) > % fail > null. */
export function wholesaleWith(s: BorongSettings, e: BorongCatalogEntry, retailCtn: number | null): number | null {
  if (s.prices[e.slug] != null) return s.prices[e.slug]
  if (e.refPriceCtn != null) return e.refPriceCtn
  const pct = s.byGroup[e.group] ?? s.defaultPct ?? BORONG_DISCOUNT.byGroup[e.group] ?? BORONG_DISCOUNT.defaultPct
  if (pct == null || retailCtn == null) return null
  return Math.round(retailCtn * (1 - pct / 100))
}

export function anyWholesale(s: BorongSettings): boolean {
  return Object.keys(s.prices).length > 0 || s.defaultPct != null || Object.keys(s.byGroup).length > 0
    || BORONG_CATALOG.some(e => e.refPriceCtn != null) || BORONG_DISCOUNT.defaultPct != null || Object.keys(BORONG_DISCOUNT.byGroup).length > 0
}

/** Tarikh kemas kini berkesan — tetapan admin > fail. */
export function effectiveUpdated(s: BorongSettings, fileUpdated: string | null): string | null {
  return s.updated ?? fileUpdated
}
