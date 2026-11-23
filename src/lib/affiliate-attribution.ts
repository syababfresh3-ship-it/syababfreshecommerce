// Affiliate produk-link — tangkap/baca attribution last-click (KLIEN).
//
// Pautan affiliate: mana-mana URL kedai dengan ?aff=KOD —
//   /products/<slug>?aff=KOD   → skop produk itu + seluruh kedai
//   /lp/<slug>?aff=KOD         → skop LP itu + seluruh kedai
//   /?aff=KOD, /shop?aff=KOD … → skop seluruh kedai ('*')
// Klik disimpan dalam localStorage {code, ts, click} ikut skop (last-click menang) dan
// dilaporkan ke /api/affiliate/click → id klik PELAYAN. Masa add-to-cart / checkout,
// kod + id klik dicap pada item/order. PELAYAN yang sahkan: affiliate wujud, tetingkap
// masa ikut masa klik di pelayan (bukan nilai di sini), kadar dari DB, bukan beli sendiri.
// Migration 139 + 165 · lihat src/lib/affiliate-stamp.ts.

const KEY = 'sf_aff'
const PRUNE_MS = 90 * 24 * 60 * 60 * 1000   // housekeeping; tetingkap sebenar dikuatkuasa pelayan
const CODE_RE = /^[A-Z0-9]{4,16}$/

export type AffEntry = { code: string; ts: number; click?: string | null }
/** Apa yang dihantar ke pelayan bersama item/order. */
export type AffPayload = { code: string; at: number; click: string | null }

function readMap(): Record<string, AffEntry> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {} } catch { return {} }
}
function writeMap(m: Record<string, AffEntry>) {
  try { window.localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* abaikan (private mode) */ }
}
function toPayload(e: AffEntry | undefined): AffPayload | null {
  return e?.code ? { code: e.code, at: e.ts, click: e.click ?? null } : null
}

/** Normalisasi kod dari URL; null jika bukan bentuk kod yang sah. */
export function normalizeAffCode(code: string | null | undefined): string | null {
  if (!code) return null
  const c = String(code).trim().toUpperCase().slice(0, 16)
  return CODE_RE.test(c) ? c : null
}

/** Skop attribution ikut laluan: '/products/x' → 'x', '/lp/x' → 'lp:x', lain → '*'. */
export function scopeFor(pathname: string | null | undefined): string {
  const p = (pathname ?? '').split('?')[0]
  let m = p.match(/^\/products\/([a-z0-9-]+)\/?$/i)
  if (m) return m[1].toLowerCase()
  m = p.match(/^\/lp\/([a-z0-9-]+)\/?$/i)
  if (m) return `lp:${m[1].toLowerCase()}`
  return '*'
}

/** Rekod klik pautan affiliate untuk beberapa skop (last-click menang). */
export function captureAff(scopes: string[], code: string | null | undefined): AffEntry | null {
  if (typeof window === 'undefined') return null
  const c = normalizeAffCode(code)
  if (!c || scopes.length === 0) return null
  const m = readMap(); const now = Date.now()
  for (const k of Object.keys(m)) if (now - (m[k]?.ts || 0) > PRUNE_MS) delete m[k]
  const entry: AffEntry = { code: c, ts: now, click: null }
  for (const s of scopes) m[s] = { ...entry }
  writeMap(m)
  return entry
}

/** Simpan id klik pelayan pada entri yang masih memegang kod yang sama. */
export function setClickId(scopes: string[], code: string, clickId: string) {
  if (typeof window === 'undefined' || !clickId) return
  const m = readMap()
  for (const s of scopes) if (m[s]?.code === code) m[s] = { ...m[s], click: clickId }
  writeMap(m)
}

/** Attribution untuk satu produk: skop produk dahulu, kemudian seluruh kedai. */
export function readAff(slug: string): AffPayload | null {
  const m = readMap()
  return toPayload(m[slug]) ?? toPayload(m['*'])
}

/** Attribution untuk satu LP: skop LP dahulu, kemudian seluruh kedai. */
export function readLpAff(slug: string): AffPayload | null {
  const m = readMap()
  return toPayload(m[`lp:${slug}`]) ?? toPayload(m['*'])
}
