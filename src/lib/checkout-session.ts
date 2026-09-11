// ============================================================
// checkout-session — pemulihan troli terbengkalai (Sprint 3F, EMAIL sahaja).
//
// Dikongsi oleh:
//   • POST/GET /api/store/checkout-session      (tangkap + pulih ikut token)
//   • /api/orders & /api/store/guest-order      (attribution: order masuk → recovered_at)
//   • /api/cron/abandoned-checkout              (pilih calon + hantar email)
//
// Fungsi TULEN (tanpa IO) di bahagian atas — boleh diuji dengan tsx tanpa DB.
// Fungsi DB di bawah semuanya best-effort: jadual belum wujud (migration 128
// belum dijalankan) → no-op senyap, TAK PERNAH gagalkan checkout/order.
// ============================================================
import { randomBytes } from 'crypto'
import { normalizePhone } from '@/lib/phone'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

export const SESSION_VALID_DAYS = 7
export const MAX_SESSION_ITEMS = 30
export const MAX_NAME_LEN = 60
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

const H = 3_600_000
// Tetingkap masa relatif kepada last_seen_at (aktiviti terakhir di checkout).
// Email 1 hanya dalam 1–23j (lepas tu dianggap basi — jangan hantar email
// "1 jam" selepas 2 hari). Email 2 hanya selepas email 1, 24–72j.
export const WINDOWS = {
  email_1h:  { minMs: 1 * H,  maxMs: 23 * H },
  email_24h: { minMs: 24 * H, maxMs: 72 * H },
} as const
export type AbandonStage = keyof typeof WINDOWS

// Toleransi race: capture terakhir (sebelum order) boleh mendarat sesaat
// selepas order dicipta → sesi baharu created_at > order.created_at.
export const ORDER_MATCH_TOLERANCE_MS = 5 * 60_000

export type CheckoutSessionItem = {
  product_id: string
  variant_id: string | null
  name: string
  qty: number
  unit_price: number
}

export type CheckoutSessionRow = {
  id: string
  email: string
  name: string | null
  phone: string | null
  items: CheckoutSessionItem[]
  subtotal: number | string | null
  token: string
  source: string | null
  created_at: string
  updated_at: string
  last_seen_at: string
  email_1h_sent_at: string | null
  email_24h_sent_at: string | null
  recovered_at: string | null
  order_ref: string | null
  unsubscribed_at: string | null
}

// Isyarat "order dah masuk" (dari orders via profiles, atau lp_guest_orders).
export type OrderSignal = {
  email: string | null
  phone: string | null
  ref: string
  at: string
}

// ── Tulen: pengesahan input ───────────────────────────────────────────

// PostgREST bila jadual belum wujud: 42P01 (Postgres) / PGRST205 (schema cache).
export function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string }
  if (e.code === '42P01' || e.code === 'PGRST205') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('could not find the table') || /relation .* does not exist/.test(m)
}

export function normalizeEmail(s: unknown): string {
  return typeof s === 'string' ? s.trim().toLowerCase() : ''
}

export function isValidEmail(s: unknown): boolean {
  const e = normalizeEmail(s)
  return e.length > 0 && e.length <= 254 && EMAIL_RE.test(e)
}

// Senarai putih medan sahaja — tiada data kad/bayaran boleh masuk.
export function sanitizeSessionItems(raw: unknown): CheckoutSessionItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SESSION_ITEMS) return null
  const out: CheckoutSessionItem[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') return null
    const { product_id, variant_id, name, qty, unit_price } = r as Record<string, unknown>
    if (typeof product_id !== 'string' || !ID_RE.test(product_id)) return null
    if (variant_id != null && (typeof variant_id !== 'string' || !ID_RE.test(variant_id))) return null
    if (typeof name !== 'string' || !name.trim()) return null
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 999) return null
    if (typeof unit_price !== 'number' || !Number.isFinite(unit_price) || unit_price < 0 || unit_price > 100_000) return null
    out.push({
      product_id,
      variant_id: (variant_id as string | null | undefined) ?? null,
      name: name.trim().slice(0, 120),
      qty,
      unit_price: Math.round(unit_price * 100) / 100,
    })
  }
  return out
}

export function sanitizeSubtotal(raw: unknown, items: CheckoutSessionItem[]): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 1_000_000) return Math.round(raw * 100) / 100
  return Math.round(items.reduce((s, i) => s + i.unit_price * i.qty, 0) * 100) / 100
}

export function newSessionToken(): string {
  return randomBytes(24).toString('base64url') // 32 aksara, selamat URL
}

// Pautan dalam email mesti domain production (dev .env.local = localhost).
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit && !explicit.includes('localhost')) return explicit.replace(/\/$/, '')
  return 'https://shop.syababfresh.my'
}

export function recoverUrl(token: string): string {
  return `${appBaseUrl()}/checkout?recover=${encodeURIComponent(token)}`
}

export function unsubscribeUrl(token: string): string {
  return `${appBaseUrl()}/api/store/checkout-session/unsubscribe?token=${encodeURIComponent(token)}`
}

export function isSessionExpired(row: Pick<CheckoutSessionRow, 'created_at'>, now = new Date()): boolean {
  return now.getTime() - new Date(row.created_at).getTime() > SESSION_VALID_DAYS * 24 * H
}

// ── Tulen: pemilihan calon cron ───────────────────────────────────────

// Peringkat email yang layak untuk sesi ini pada masa `now`; null = tiada.
// `force` (dry-run sahaja) abaikan tetingkap masa tapi masih hormati stamp.
export function stageForSession(row: CheckoutSessionRow, now: Date, force = false): AbandonStage | null {
  if (row.recovered_at || row.unsubscribed_at) return null
  const age = now.getTime() - new Date(row.last_seen_at).getTime()
  if (!Number.isFinite(age)) return null
  if (!row.email_1h_sent_at) {
    const w = WINDOWS.email_1h
    return force || (age >= w.minMs && age <= w.maxMs) ? 'email_1h' : null
  }
  if (!row.email_24h_sent_at) {
    const w = WINDOWS.email_24h
    return force || (age >= w.minMs && age <= w.maxMs) ? 'email_24h' : null
  }
  return null
}

// Order oleh email/telefon yang sama SELEPAS sesi dicipta (± toleransi race).
export function findOrderForSession(
  row: Pick<CheckoutSessionRow, 'email' | 'phone' | 'created_at'>,
  orders: OrderSignal[],
  toleranceMs = ORDER_MATCH_TOLERANCE_MS,
): OrderSignal | null {
  const email = normalizeEmail(row.email)
  const phone = normalizePhone(row.phone)
  const floor = new Date(row.created_at).getTime() - toleranceMs
  for (const o of orders) {
    const at = new Date(o.at).getTime()
    if (!Number.isFinite(at) || at < floor) continue
    if (email && normalizeEmail(o.email) === email) return o
    if (phone && normalizePhone(o.phone) === phone) return o
  }
  return null
}

export type Candidate = { row: CheckoutSessionRow; stage: AbandonStage }
export type SelectionResult = {
  candidates: Candidate[]
  recoveredByOrder: { row: CheckoutSessionRow; order: OrderSignal }[]
  skipped: { id: string; email: string; reason: 'suppressed' | 'unsubscribed' | 'recovered' | 'outside_window' | 'duplicate_email' }[]
}

// Pilih calon untuk satu run cron. Tertib: suppression → order masuk →
// tetingkap masa → satu email per alamat per run → had `cap`.
export function selectAbandonedCandidates(
  rows: CheckoutSessionRow[],
  opts: { now: Date; suppressed: Set<string>; orders: OrderSignal[]; force?: boolean; cap?: number },
): SelectionResult {
  const cap = opts.cap ?? 50
  const res: SelectionResult = { candidates: [], recoveredByOrder: [], skipped: [] }
  const seen = new Set<string>()
  // Sesi paling baru dahulu — kalau ada 2 sesi terbuka untuk email sama
  // (race capture), yang terkini menang.
  const sorted = [...rows].sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())

  for (const row of sorted) {
    const email = normalizeEmail(row.email)
    if (row.recovered_at) { res.skipped.push({ id: row.id, email, reason: 'recovered' }); continue }
    if (row.unsubscribed_at) { res.skipped.push({ id: row.id, email, reason: 'unsubscribed' }); continue }
    if (opts.suppressed.has(email)) { res.skipped.push({ id: row.id, email, reason: 'suppressed' }); continue }
    const order = findOrderForSession(row, opts.orders)
    if (order) { res.recoveredByOrder.push({ row, order }); continue }
    const stage = stageForSession(row, opts.now, opts.force)
    if (!stage) { res.skipped.push({ id: row.id, email, reason: 'outside_window' }); continue }
    if (seen.has(email)) { res.skipped.push({ id: row.id, email, reason: 'duplicate_email' }); continue }
    seen.add(email)
    if (res.candidates.length < cap) res.candidates.push({ row, stage })
  }
  return res
}

// ── DB (service role) — semua best-effort ─────────────────────────────

export type UpsertInput = {
  email: string
  name?: string | null
  phone?: string | null
  items: CheckoutSessionItem[]
  subtotal: number
  source?: string
}

// Satu sesi terbuka per email (belum pulih, ≤ 7 hari) → kemas kini snapshot
// + last_seen_at; jika tiada, cipta sesi baharu dengan token baharu.
export async function upsertCheckoutSession(admin: SB, input: UpsertInput): Promise<{ ok: boolean; skipped?: string }> {
  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) return { ok: false, skipped: 'invalid_email' }
  const now = new Date().toISOString()
  const since = new Date(Date.now() - SESSION_VALID_DAYS * 24 * H).toISOString()
  const snapshot = {
    name: (input.name ?? '').trim().slice(0, MAX_NAME_LEN) || null,
    phone: normalizePhone(input.phone) || null,
    items: input.items,
    subtotal: input.subtotal,
    last_seen_at: now,
    updated_at: now,
  }

  const { data: open, error: findErr } = await admin
    .from('checkout_sessions')
    .select('id')
    .eq('email', email)
    .is('recovered_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (findErr) {
    if (isMissingTableError(findErr)) return { ok: true, skipped: 'missing_table' }
    console.warn('[checkout-session] find gagal:', findErr.message)
    return { ok: false, skipped: 'db_error' }
  }

  if (open?.id) {
    const { error } = await admin.from('checkout_sessions').update(snapshot).eq('id', open.id)
    if (error) { console.warn('[checkout-session] update gagal:', error.message); return { ok: false, skipped: 'db_error' } }
    return { ok: true }
  }

  const { error } = await admin.from('checkout_sessions').insert({
    email,
    ...snapshot,
    token: newSessionToken(),
    source: input.source ?? 'checkout',
  })
  if (error) {
    if (isMissingTableError(error)) return { ok: true, skipped: 'missing_table' }
    console.warn('[checkout-session] insert gagal:', error.message)
    return { ok: false, skipped: 'db_error' }
  }
  return { ok: true }
}

// Order masuk → tandakan sesi terbuka (email ATAU telefon sama, ≤ 7 hari)
// sebagai pulih. Dua kemas kini berasingan (elak .or() PostgREST dengan
// nilai pengguna). Tak pernah throw — dipanggil selepas order berjaya.
export async function markCheckoutSessionsRecovered(
  admin: SB,
  input: { email?: string | null; phone?: string | null; orderRef: string },
): Promise<void> {
  try {
    const now = new Date().toISOString()
    const since = new Date(Date.now() - SESSION_VALID_DAYS * 24 * H).toISOString()
    const patch = { recovered_at: now, order_ref: String(input.orderRef).slice(0, 64), updated_at: now }
    const email = normalizeEmail(input.email)
    const phone = normalizePhone(input.phone)
    if (email) {
      const { error } = await admin.from('checkout_sessions').update(patch)
        .eq('email', email).is('recovered_at', null).gte('created_at', since)
      if (error && !isMissingTableError(error)) console.warn('[checkout-session] mark (email) gagal:', error.message)
      if (error && isMissingTableError(error)) return
    }
    if (phone) {
      const { error } = await admin.from('checkout_sessions').update(patch)
        .eq('phone', phone).is('recovered_at', null).gte('created_at', since)
      if (error && !isMissingTableError(error)) console.warn('[checkout-session] mark (phone) gagal:', error.message)
    }
  } catch (err) {
    console.warn('[checkout-session] mark recovered ralat:', (err as Error)?.message)
  }
}
