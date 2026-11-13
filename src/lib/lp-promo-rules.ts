// ============================================================
// lp-promo-rules — Peraturan promo setempat per landing page (migration 160). PURE: klien & pelayan.
//
// Dibina untuk promo perkenalan komuniti (cth. /lp/bangi): harga khas LP sahaja, kawasan hantar
// terhad ikut poskod, caj rata (Lalamove), minimum order, had percuma, slot hantar, hadiah
// automatik dan kuota "N unit pertama".
//
// Harga kedai utama TIDAK berubah — harga khas hanya dipakai bila order masuk melalui LP ini.
// Kuat kuasa SEBENAR di /api/lp/[slug]/order (klien hanya papar).
// ============================================================

export interface LpPromoRules {
  enabled: boolean
  /** Poskod yang dibenarkan untuk penghantaran. Kosong = semua (ikut zon biasa). */
  postcodes: string[]
  /** Caj hantar rata (RM). null = ikut zon/kurier biasa. */
  flat_fee: number | null
  /** Caj ikut poskod (RM) — menggantikan flat_fee untuk poskod itu sahaja (cth. Kajang 43000 → 8, Bangi kekal rata). */
  fees: Record<string, number>
  /** Subtotal minimum untuk PENGHANTARAN (ambil sendiri tiada minimum). null = tiada. */
  min_subtotal: number | null
  /** Subtotal untuk hantar percuma (dengan caj rata). null = ikut had percuma kedai. */
  free_min: number | null
  /** Slot hantar yang pelanggan pilih (cth. "11:00 pagi"). Kosong = tiada pilihan slot. */
  slots: string[]
  /** Hadiah untuk ambil sendiri (cth. "3 biji persimmon"). Kosong = tiada. */
  gift_pickup: string
  /** Hadiah bila subtotal ≥ gift_min (cth. "5 biji persimmon"). */
  gift_min: number | null
  gift_min_label: string
  /** Harga khas LP: kunci "slug-produk" atau "slug-produk:Nama Variasi" → RM. */
  prices: Record<string, number>
  /** Kuota jualan LP ini: kunci "slug-produk" → unit maksimum (order dibatalkan tak dikira). */
  quotas: Record<string, number>
  /** Had kuantiti setiap produk dalam satu order (cth. 2 pek). null = tiada had. */
  max_qty: number | null
  /** Slug produk yang DIKECUALIKAN daripada max_qty (cth. produk kedai biasa yang ditumpang dalam LP promo). */
  max_qty_exempt: string[]
}

export const DEFAULT_LP_PROMO_RULES: LpPromoRules = {
  enabled: false, postcodes: [], flat_fee: null, fees: {}, min_subtotal: null, free_min: null, slots: [],
  gift_pickup: '', gift_min: null, gift_min_label: '', prices: {}, quotas: {}, max_qty: null, max_qty_exempt: [],
}

const r2 = (n: number) => Math.round(n * 100) / 100
const money = (v: unknown): number | null => {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? r2(n) : null
}
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const keyOk = (k: string) => /^[a-z0-9-]+(?::.{1,80})?$/i.test(k)

function numMap(raw: unknown, int: boolean): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k0, v] of Object.entries(raw as Record<string, unknown>)) {
    const k = normKey(k0)
    const n = money(v)
    if (!k || !keyOk(k) || n == null) continue
    out[k] = int ? Math.max(0, Math.floor(n)) : n
    if (Object.keys(out).length >= 100) break
  }
  return out
}

/** Peta poskod (5 digit) → RM. Kunci lain dibuang senyap. */
function postcodeMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(numMap(raw, false))) if (/^\d{5}$/.test(k)) out[k] = v
  return out
}

/** Kunci dinormalkan: slug huruf kecil, nama variasi kekal (dipadan tanpa kira huruf besar/kecil). */
export function normKey(k: string): string {
  const s = String(k ?? '').trim()
  const i = s.indexOf(':')
  if (i < 0) return s.toLowerCase()
  return `${s.slice(0, i).trim().toLowerCase()}:${s.slice(i + 1).trim()}`
}

/** JSON DB/borang admin → peraturan sah. null/bukan objek → null (= tiada peraturan). */
export function normalizeLpPromoRules(raw: unknown): LpPromoRules | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const postcodes = Array.isArray(o.postcodes)
    ? [...new Set(o.postcodes.map(p => String(p).trim()).filter(p => /^\d{5}$/.test(p)))].slice(0, 500)
    : []
  const slots = Array.isArray(o.slots)
    ? [...new Set(o.slots.map(s => text(s, 40)).filter(Boolean))].slice(0, 12)
    : []
  return {
    enabled: o.enabled === true || o.enabled === 'true',
    postcodes,
    flat_fee: money(o.flat_fee),
    fees: postcodeMap(o.fees),
    min_subtotal: money(o.min_subtotal) || null,
    free_min: money(o.free_min) || null,
    slots,
    gift_pickup: text(o.gift_pickup, 80),
    gift_min: money(o.gift_min) || null,
    gift_min_label: text(o.gift_min_label, 80),
    prices: numMap(o.prices, false),
    quotas: numMap(o.quotas, true),
    max_qty: (() => { const n = money(o.max_qty); return n != null && n >= 1 ? Math.min(99, Math.floor(n)) : null })(),
    max_qty_exempt: Array.isArray(o.max_qty_exempt)
      ? [...new Set(o.max_qty_exempt.map(s => String(s).trim().toLowerCase()).filter(s => /^[a-z0-9-]+$/.test(s)))].slice(0, 100)
      : [],
  }
}

/** Peraturan aktif (enabled) atau null. */
export function activeRules(raw: unknown): LpPromoRules | null {
  const r = normalizeLpPromoRules(raw)
  return r?.enabled ? r : null
}

// ── Teks borang admin ⇄ peta ("slug = 10" satu baris satu) ───────────
export function mapToLines(m: Record<string, number>): string {
  return Object.entries(m).map(([k, v]) => `${k} = ${v}`).join('\n')
}
export function linesToMap(s: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of String(s ?? '').split('\n')) {
    const i = line.lastIndexOf('=')
    if (i < 0) continue
    const k = normKey(line.slice(0, i))
    const n = Number(line.slice(i + 1).trim())
    if (k && Number.isFinite(n)) out[k] = n
  }
  return out
}

// ── Harga khas ──────────────────────────────────────────────────────
/** Harga khas untuk produk/variasi, atau null (= harga biasa). Variasi dipadan dulu, kemudian produk. */
export function promoPriceFor(rules: LpPromoRules | null, productSlug: string | null | undefined, variantName?: string | null): number | null {
  if (!rules || !productSlug) return null
  const slug = productSlug.toLowerCase()
  if (variantName) {
    const want = `${slug}:${variantName.trim()}`.toLowerCase()
    for (const [k, v] of Object.entries(rules.prices)) if (k.toLowerCase() === want) return v
  }
  return rules.prices[slug] ?? null
}

type PriceRow = { price: number | string; compare_price?: number | string | null; name?: string }
type ProductRow = PriceRow & { slug: string; product_variants?: PriceRow[] | null }

/**
 * Untuk paparan LP: ganti harga dengan harga khas; harga asal jadi compare_price (harga potong)
 * bila ia lebih tinggi. Pulangkan salinan baru (tak ubah objek cache).
 */
export function applyPromoPrices<T extends ProductRow>(rules: LpPromoRules | null, products: T[]): T[] {
  if (!rules || Object.keys(rules.prices).length === 0) return products
  const swap = <R extends PriceRow>(row: R, promo: number | null): R => {
    if (promo == null) return row
    const orig = Number(row.compare_price ?? 0) > Number(row.price) ? Number(row.compare_price) : Number(row.price)
    return { ...row, price: promo, compare_price: orig > promo ? orig : null }
  }
  return products.map(p => ({
    ...swap(p, promoPriceFor(rules, p.slug)),
    product_variants: p.product_variants?.map(v => swap(v, promoPriceFor(rules, p.slug, v.name))) ?? p.product_variants,
  }))
}

// ── Penghantaran ────────────────────────────────────────────────────
export type PromoDelivery =
  | { handled: false }                                          // ikut zon biasa (tiada caj rata)
  | { handled: true; available: false; error: string }
  | { handled: true; available: true; fee: number; belowMin: number | null }

/** Sebut harga hantar ikut peraturan LP. Ambil sendiri sentiasa RM0 tanpa minimum. */
export function promoDelivery(rules: LpPromoRules | null, opts: { postcode?: string | null; subtotal: number; isPickup: boolean; defaultFreeMin?: number }): PromoDelivery {
  if (!rules) return { handled: false }
  if (opts.isPickup) return { handled: true, available: true, fee: 0, belowMin: null }
  const pc = String(opts.postcode ?? '').trim()
  if (rules.postcodes.length > 0 && /^\d{5}$/.test(pc) && !rules.postcodes.includes(pc)) {
    return { handled: true, available: false, error: 'Maaf, promo ini untuk kawasan terpilih sahaja. Pilih "Ambil Sendiri" atau hubungi kami.' }
  }
  // Caj ikut poskod menang atas caj rata (cth. Kajang RM8, Bangi RM5); poskod belum diisi → caj rata
  const flat = (pc ? rules.fees[pc] : undefined) ?? rules.flat_fee
  if (flat == null) return { handled: false }
  const belowMin = rules.min_subtotal != null && opts.subtotal < rules.min_subtotal ? r2(rules.min_subtotal - opts.subtotal) : null
  // free_min kosong → ikut had percuma kedai (bila diberi)
  const freeAt = rules.free_min ?? opts.defaultFreeMin ?? null
  const free = freeAt != null && opts.subtotal >= freeAt
  return { handled: true, available: true, fee: free ? 0 : flat, belowMin }
}

/** Hadiah yang layak (teks), atau null. */
export function promoGift(rules: LpPromoRules | null, opts: { subtotal: number; isPickup: boolean }): string | null {
  if (!rules) return null
  const gifts: string[] = []
  if (opts.isPickup && rules.gift_pickup) gifts.push(rules.gift_pickup)
  if (rules.gift_min != null && rules.gift_min_label && opts.subtotal >= rules.gift_min) gifts.push(rules.gift_min_label)
  return gifts.length ? gifts.join(' + ') : null
}

// ── Nota order LP ──────────────────────────────────────────────────────────────
// Slot & hadiah promo direkod di AWAL nota order (satu lajur `notes` sedia ada, tiada migration)
// dalam format tetap "[Slot: …] [🎁 Hadiah: …] nota pelanggan". format/parse disimpan sebelah-
// menyebelah supaya admin & emel boleh pecahkan semula tanpa meneka.
const SLOT_RE = /\[Slot:\s*([^\]]+)\]/
const GIFT_RE = /\[(?:🎁\s*)?Hadiah:\s*([^\]]+)\]/

/** Bina nota order: slot & hadiah di depan, nota pelanggan di belakang. null bila semuanya kosong. */
export function formatPromoNotes(notes: unknown, slot: string | null, gift: string | null): string | null {
  const parts = [slot ? `[Slot: ${slot}]` : '', gift ? `[🎁 Hadiah: ${gift}]` : '', typeof notes === 'string' ? notes.trim() : '']
  const s = parts.filter(Boolean).join(' ')
  return s || null
}

/** Pecahkan nota order kepada slot / hadiah / nota pelanggan asal. Nota tanpa tag → semuanya `rest`. */
export function parsePromoNotes(notes: string | null | undefined): { slot: string | null; gift: string | null; rest: string } {
  const s = typeof notes === 'string' ? notes : ''
  const slot = s.match(SLOT_RE)?.[1]?.trim() ?? null
  const gift = s.match(GIFT_RE)?.[1]?.trim() ?? null
  const rest = s.replace(SLOT_RE, '').replace(GIFT_RE, '').replace(/\s+/g, ' ').trim()
  return { slot, gift, rest }
}

/** Subset selamat untuk dihantar ke pelayar (tiada senarai poskod penuh / harga dalaman). */
export interface LpPromoPublic {
  slots: string[]
  min_subtotal: number | null
  free_min: number | null
  flat_fee: number | null
  gift_pickup: string
  gift_min: number | null
  gift_min_label: string
  /** product_id → baki kuota (null = tiada kuota). */
  remaining: Record<string, number>
  /** Had kuantiti setiap produk per order. */
  max_qty: number | null
  /** product_id yang dikecualikan daripada max_qty (dipetakan dari slug oleh page LP). */
  max_qty_exempt_ids: string[]
}
export function toPublicRules(rules: LpPromoRules | null, remaining: Record<string, number> = {}, exemptIds: string[] = []): LpPromoPublic | null {
  if (!rules) return null
  return {
    slots: rules.slots, min_subtotal: rules.min_subtotal, free_min: rules.free_min, flat_fee: rules.flat_fee,
    gift_pickup: rules.gift_pickup, gift_min: rules.gift_min, gift_min_label: rules.gift_min_label, remaining, max_qty: rules.max_qty,
    max_qty_exempt_ids: exemptIds,
  }
}

/** Had kuantiti untuk produk ini di pelayar (null = tiada had / dikecualikan). */
export function maxQtyFor(pub: LpPromoPublic | null | undefined, productId: string): number | null {
  if (!pub || pub.max_qty == null) return null
  return pub.max_qty_exempt_ids.includes(productId) ? null : pub.max_qty
}

/** Sebab borang tak boleh dihantar (klien), atau null. Pelayan semak semula. */
export function promoBlockReason(pub: LpPromoPublic | null, opts: { subtotal: number; isPickup: boolean; slot: string }): string | null {
  if (!pub) return null
  if (!opts.isPickup && pub.min_subtotal != null && opts.subtotal < pub.min_subtotal)
    return `Minimum RM${pub.min_subtotal} untuk penghantaran (atau pilih Ambil Sendiri)`
  if (!opts.isPickup && pub.slots.length > 0 && !pub.slots.includes(opts.slot))
    return 'Sila pilih slot penghantaran'
  return null
}

// ── Borang admin (semua medan teks) ⇄ peraturan ─────────────────────
export interface LpPromoDraft {
  enabled: boolean
  postcodes: string      // dipisah koma / ruang / baris
  flat_fee: string
  fees: string           // "43000 = 8" satu baris satu
  min_subtotal: string
  free_min: string
  slots: string          // dipisah koma
  gift_pickup: string
  gift_min: string
  gift_min_label: string
  prices: string         // "slug = 10" satu baris satu
  quotas: string         // "slug = 50" satu baris satu
  max_qty: string
  max_qty_exempt: string // slug dipisah koma
}

export const EMPTY_LP_PROMO_DRAFT: LpPromoDraft = {
  enabled: false, postcodes: '', flat_fee: '', fees: '', min_subtotal: '', free_min: '', slots: '',
  gift_pickup: '', gift_min: '', gift_min_label: '', prices: '', quotas: '', max_qty: '', max_qty_exempt: '',
}

const s = (n: number | null) => (n == null ? '' : String(n))
export function draftFromRules(raw: unknown): LpPromoDraft {
  const r = normalizeLpPromoRules(raw)
  if (!r) return EMPTY_LP_PROMO_DRAFT
  return {
    enabled: r.enabled, postcodes: r.postcodes.join(', '), flat_fee: s(r.flat_fee), fees: mapToLines(r.fees), min_subtotal: s(r.min_subtotal),
    free_min: s(r.free_min), slots: r.slots.join(', '), gift_pickup: r.gift_pickup, gift_min: s(r.gift_min),
    gift_min_label: r.gift_min_label, prices: mapToLines(r.prices), quotas: mapToLines(r.quotas), max_qty: s(r.max_qty),
    max_qty_exempt: r.max_qty_exempt.join(', '),
  }
}

/** Draf → peraturan (dinormalkan). Semua kosong & tak aktif → null (= tiada peraturan). */
export function rulesFromDraft(d: LpPromoDraft): LpPromoRules | null {
  const blank = !d.enabled && Object.entries(d).every(([k, v]) => k === 'enabled' || String(v).trim() === '')
  if (blank) return null
  return normalizeLpPromoRules({
    enabled: d.enabled,
    postcodes: d.postcodes.split(/[\s,;]+/).filter(Boolean),
    flat_fee: d.flat_fee, fees: linesToMap(d.fees), min_subtotal: d.min_subtotal, free_min: d.free_min,
    slots: d.slots.split(',').map(x => x.trim()).filter(Boolean),
    gift_pickup: d.gift_pickup, gift_min: d.gift_min, gift_min_label: d.gift_min_label,
    prices: linesToMap(d.prices), quotas: linesToMap(d.quotas), max_qty: d.max_qty,
    max_qty_exempt: d.max_qty_exempt.split(/[\s,;]+/).filter(Boolean),
  })
}
