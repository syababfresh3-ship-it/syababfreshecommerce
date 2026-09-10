// Carian & susunan katalog — fungsi tulen (tiada React/DOM/Supabase) supaya
// senang diuji unit dan boleh dikongsi antara katalog (sf-catalog) dan mana-mana
// senarai produk lain.
//
// Carian: padan pada nama + nama kategori + description, tak kira huruf besar/
// kecil & diakritik, ikut token (SEMUA token mesti padan pada salah satu medan),
// dengan peta sinonim BM/EN kecil (ceri↔cherry, anggur↔grape, kurma↔dates ...).
//
// Susunan: disyorkan (susunan asal / relevan), harga naik/turun, terbaru —
// produk habis stok SENTIASA di hujung tak kira susunan.

export interface SearchFields {
  name: string
  category?: string | null
  description?: string | null
}

// Kumpulan sinonim dua hala — setiap perkataan dalam kumpulan memadankan yang
// lain. Perkataan tunggal sahaja (token carian dipecah ikut ruang/tanda baca).
const SYNONYM_GROUPS: string[][] = [
  ['ceri', 'cherry', 'cherries'],
  ['anggur', 'grape', 'grapes'],
  ['kurma', 'dates', 'tamar'],
  ['delima', 'pomegranate'],
  ['epal', 'apple'],
  ['oren', 'limau', 'orange'],
  ['tembikai', 'watermelon'],
  ['strawberi', 'strawberry', 'stroberi'],
  ['mangga', 'mango'],
  ['pear', 'pir'],
  ['plum', 'prun'],
  ['jus', 'juice'],
  ['kismis', 'raisin'],
  ['kacang', 'nut', 'nuts'],
  ['aprikot', 'apricot'],
  ['pisang', 'banana'],
  ['avokado', 'avocado'],
  ['laici', 'lychee'],
  ['nenas', 'pineapple'],
]

/** Huruf kecil, buang diakritik (é→e), kemaskan ruang. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const SYNONYMS: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>()
  for (const group of SYNONYM_GROUPS) {
    const g = group.map(normalizeText)
    for (const w of g) m.set(w, g.filter((x) => x !== w))
  }
  return m
})()

/** Pecah pertanyaan kepada token alfanumerik (tanda baca dibuang). */
export function tokenize(q: string): string[] {
  return normalizeText(q).split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Token + sinonimnya (token asal sentiasa di depan). Token ≥ 3 aksara yang
 * merupakan AWALAN kata sinonim ("cher") turut dapat kumpulan itu — supaya
 * carian sambil menaip dah jumpa "Ceri" sebelum "cherry" habis ditaip.
 */
export function expandToken(token: string): string[] {
  const t = normalizeText(token)
  if (!t) return []
  const out = new Set<string>([t])
  const direct = SYNONYMS.get(t)
  if (direct) {
    direct.forEach((s) => out.add(s))
  } else if (t.length >= 3) {
    for (const [key, syns] of SYNONYMS) {
      if (key.startsWith(t)) {
        out.add(key)
        syns.forEach((s) => out.add(s))
      }
    }
  }
  return [...out]
}

// Kategori & description dipadan ikut AWALAN PERKATAAN (" jus" ≠ "gajus") supaya
// teks panjang tak beri padanan palsu; nama produk kekal substring supaya tak
// terlepas (cth "28mm", "5biji").
function wordHaystack(s: string): string {
  return ` ${normalizeText(s).replace(/[^a-z0-9]+/g, ' ')} `
}

/**
 * Skor padanan: 0 = tak padan. Setiap token MESTI padan pada salah satu medan;
 * nama beri 3 mata, kategori 2, description 1 — jumlah dipakai untuk susunan relevan.
 */
export function searchScore(fields: SearchFields, query: string): number {
  const tokens = tokenize(query)
  if (!tokens.length) return 0
  const name = normalizeText(fields.name)
  const cat = fields.category ? wordHaystack(fields.category) : ''
  const desc = fields.description ? wordHaystack(fields.description) : ''
  let score = 0
  for (const token of tokens) {
    const vars = expandToken(token)
    const inName = name.length > 0 && vars.some((v) => name.includes(v))
    const inWords = (hay: string) => hay.length > 0 && vars.some((v) => hay.includes(` ${v}`))
    if (inName) score += 3
    else if (inWords(cat)) score += 2
    else if (inWords(desc)) score += 1
    else return 0
  }
  return score
}

/** Tapis + susun ikut relevan (skor tinggi dulu; seri kekal susunan asal). */
export function searchItems<T>(items: readonly T[], query: string, fields: (item: T) => SearchFields): T[] {
  if (!tokenize(query).length) return []
  return items
    .map((item, i) => ({ item, i, score: searchScore(fields(item), query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.item)
}

// ── Susunan ──────────────────────────────────────────────────────────────

export type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'newest'

export const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'recommended', label: 'Disyorkan' },
  { value: 'price_asc', label: 'Harga rendah → tinggi' },
  { value: 'price_desc', label: 'Harga tinggi → rendah' },
  { value: 'newest', label: 'Terbaru' },
]

/** Param URL ?sort= → SortKey; nilai tak dikenali / kosong = disyorkan. */
export function parseSortKey(v: string | null | undefined): SortKey {
  return v && SORT_OPTIONS.some((o) => o.value === v) ? (v as SortKey) : 'recommended'
}

/** Bentuk minimum produk yang boleh disusun (subset kad katalog). */
export interface SortableProduct {
  price: number
  created_at?: string | null
  product_variants?: ReadonlyArray<{ price: number; is_active?: boolean; stock?: number | null }>
  product_stock?: ReadonlyArray<{ available_stock: number | null }>
}

function activeVariants(p: SortableProduct) {
  return (p.product_variants ?? []).filter((v) => v.is_active !== false)
}

/** Harga terendah (variant aktif termurah, atau harga produk). */
export function minPrice(p: SortableProduct): number {
  const vs = activeVariants(p)
  return vs.length ? Math.min(...vs.map((v) => Number(v.price))) : Number(p.price)
}

/**
 * Habis stok — peraturan SAMA dengan badge "Habis stok" pada SfProductCard:
 * ada variant → SEMUA variant aktif stok ≤ 0; tiada variant → view product_stock ≤ 0.
 * Stok tak dijejak (undefined / tiada row) = anggap ada.
 */
export function isSoldOut(p: SortableProduct): boolean {
  const vs = activeVariants(p)
  if (vs.length) return vs.every((v) => v.stock !== undefined && v.stock !== null && v.stock <= 0)
  const ps = p.product_stock ?? []
  return ps.length > 0 && (ps[0].available_stock ?? 1) <= 0
}

function ts(v: string | null | undefined): number {
  const n = v ? Date.parse(v) : NaN
  return Number.isNaN(n) ? 0 : n
}

/**
 * Susun senarai (salinan baharu; stabil — seri kekal susunan asal, iaitu
 * sort_order DB atau relevan carian). Produk habis stok SENTIASA di hujung.
 */
export function sortProducts<T extends SortableProduct>(items: readonly T[], sort: SortKey): T[] {
  const cmp = (a: T, b: T): number => {
    switch (sort) {
      case 'price_asc': return minPrice(a) - minPrice(b)
      case 'price_desc': return minPrice(b) - minPrice(a)
      case 'newest': return ts(b.created_at) - ts(a.created_at)
      default: return 0
    }
  }
  return items
    .map((item, i) => ({ item, i, out: isSoldOut(item) ? 1 : 0 }))
    .sort((a, b) => a.out - b.out || cmp(a.item, b.item) || a.i - b.i)
    .map((r) => r.item)
}
