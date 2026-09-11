// ============================================================
// promo-rules.ts — SATU tempat untuk semua peraturan kod promosi.
//
// Sebelum ini logik yang sama disalin di lima tempat (checkout member,
// lib/lp-promo, /api/orders, /api/store/guest-order, /api/lp/[slug]/order)
// dan mudah terpesong. Fail ini PURE — tiada import DB, tiada I/O — supaya
// client & server boleh guna benda yang sama, dan boleh diuji unit.
//
// TOLERAN MIGRATION: kolum Sprint 3H (starts_at, scope_*, per_user_limit,
// type='free_shipping') mungkin BELUM wujud dalam DB. Semua medan baru
// bersifat optional di sini — kalau undefined/null, kelakuan kembali sama
// seperti sebelum ini. Pemanggil digalakkan select('*') supaya kolum yang
// tiada sekadar hilang, bukan error 42703/PGRST204.
// ============================================================

export type PromoType = 'percentage' | 'fixed' | 'free_shipping'

/** Baris promo_codes seperti dibaca dari DB (kolum baru mungkin tiada). */
export interface PromoRow {
  id?: string
  code?: string
  type: string
  value: number | string | null
  min_order?: number | string | null
  max_uses?: number | null
  uses_count?: number | null
  active?: boolean | null
  expires_at?: string | Date | null
  // Sprint 3H (migration 131)
  starts_at?: string | Date | null
  scope_product_ids?: string[] | null
  scope_category_ids?: string[] | null
  per_user_limit?: number | null
}

/** Satu baris troli — line_total = harga unit × kuantiti. */
export interface PromoItem {
  product_id: string
  category_id?: string | null
  line_total: number
}

export interface PromoContext {
  subtotal: number
  deliveryFee: number
  items: PromoItem[]
  now?: Date
  /** Berapa kali pelanggan ini dah guna kod (member: ikut user_id; guest: ikut telefon). */
  priorUses?: number
}

export type PromoResult =
  | { ok: true; discount: number; freeShipping: boolean; eligibleSubtotal: number }
  | { ok: false; error: string }

export const PROMO_ERRORS = {
  invalid:   'Kod tidak sah atau tidak aktif',
  notYet:    'Kod belum bermula',
  expired:   'Kod sudah tamat tempoh',
  maxUses:   'Kod sudah mencapai had penggunaan',
  scope:     'Kod ini untuk produk tertentu sahaja',
  perUser:   'Kod ini sudah digunakan',
} as const

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function ids(v: string[] | null | undefined): string[] {
  return Array.isArray(v) ? v.filter(Boolean) : []
}

/**
 * Sahkan kod promosi + kira diskaun. Susunan semakan (penting untuk mesej
 * yang dilihat pelanggan): aktif → belum bermula → tamat tempoh → had global
 * → had per pelanggan → min. pesanan → skop produk.
 *
 * min_order sengaja dibanding dengan subtotal PENUH (bukan subtotal layak) —
 * kekal makna asal "min. belanja untuk guna kod ini".
 */
export function evaluatePromo(promo: PromoRow | null | undefined, ctx: PromoContext): PromoResult {
  if (!promo || promo.active === false) return { ok: false, error: PROMO_ERRORS.invalid }

  const type = promo.type as PromoType
  if (type !== 'percentage' && type !== 'fixed' && type !== 'free_shipping') {
    return { ok: false, error: PROMO_ERRORS.invalid }
  }

  const now = ctx.now ?? new Date()

  const startsAt = toDate(promo.starts_at)
  if (startsAt && startsAt > now) return { ok: false, error: PROMO_ERRORS.notYet }

  const expiresAt = toDate(promo.expires_at)
  if (expiresAt && expiresAt < now) return { ok: false, error: PROMO_ERRORS.expired }

  if (promo.max_uses !== null && promo.max_uses !== undefined && num(promo.uses_count) >= num(promo.max_uses)) {
    return { ok: false, error: PROMO_ERRORS.maxUses }
  }

  // Had per pelanggan — hanya bila admin set. null = kelakuan lama (member
  // sekali seorang dikuatkuasakan oleh /api/orders seperti dulu).
  if (promo.per_user_limit !== null && promo.per_user_limit !== undefined) {
    const limit = num(promo.per_user_limit)
    if (limit > 0 && num(ctx.priorUses) >= limit) return { ok: false, error: PROMO_ERRORS.perUser }
  }

  const subtotal = num(ctx.subtotal)
  const minOrder = num(promo.min_order)
  if (subtotal < minOrder) {
    return { ok: false, error: `Min. pesanan RM${minOrder.toFixed(2)} untuk kod ini` }
  }

  // ── Skop produk/kategori ──────────────────────────────────
  const scopeProducts = ids(promo.scope_product_ids)
  const scopeCategories = ids(promo.scope_category_ids)
  const scoped = scopeProducts.length > 0 || scopeCategories.length > 0

  let eligibleSubtotal = subtotal
  if (scoped) {
    const pset = new Set(scopeProducts)
    const cset = new Set(scopeCategories)
    const eligible = (ctx.items ?? []).filter(
      it => pset.has(it.product_id) || (it.category_id ? cset.has(it.category_id) : false)
    )
    if (eligible.length === 0) return { ok: false, error: PROMO_ERRORS.scope }
    eligibleSubtotal = eligible.reduce((s, it) => s + num(it.line_total), 0)
  }
  eligibleSubtotal = Math.max(0, eligibleSubtotal)

  // ── Diskaun ───────────────────────────────────────────────
  if (type === 'free_shipping') {
    // Pickup / memang percuma → fee 0 → diskaun 0 (kod tetap sah).
    const discount = Math.max(0, num(ctx.deliveryFee))
    return { ok: true, discount, freeShipping: true, eligibleSubtotal }
  }

  const value = num(promo.value)
  const discount = type === 'percentage'
    ? Math.min((eligibleSubtotal * value) / 100, eligibleSubtotal)
    : Math.min(value, eligibleSubtotal)

  return { ok: true, discount: Math.max(0, discount), freeShipping: false, eligibleSubtotal }
}

/** Label ringkas untuk UI: "Hantar percuma" · "10%" · "RM5". */
export function promoLabel(promo: Pick<PromoRow, 'type' | 'value'> | null | undefined): string {
  if (!promo) return ''
  if (promo.type === 'free_shipping') return 'Hantar percuma'
  const v = num(promo.value)
  if (promo.type === 'percentage') return `${Number.isInteger(v) ? v : v.toFixed(2)}%`
  return `RM${Number.isInteger(v) ? v : v.toFixed(2)}`
}

/** Ada skop produk/kategori? (untuk badge ringkas di admin/UI) */
export function promoScopeCount(promo: Pick<PromoRow, 'scope_product_ids' | 'scope_category_ids'> | null | undefined): number {
  if (!promo) return 0
  return ids(promo.scope_product_ids).length + ids(promo.scope_category_ids).length
}

/** Kolum baru 131 belum ada dalam DB? (PostgREST: PGRST204 · Postgres: 42703) */
export function isMissingColumnError(err: { code?: string | null } | null | undefined): boolean {
  const code = err?.code ?? ''
  return code === '42703' || code === 'PGRST204'
}
