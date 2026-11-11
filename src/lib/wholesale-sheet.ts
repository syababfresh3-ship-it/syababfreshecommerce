// Sheet pemilik "MASTER HARGA KURMA 2027" › tab "Harga Wholesale 2027" — harga borong per KARTON ikut
// 3 tier kuantiti (1–2 · 3–9 · 10+ karton), kos/kg, rizab operasi & kos asas; parameter margin/marketing
// di bawah jadual. Gred ikut NAMA SUPPLIER (Ajwa AA / AA Premium / Large …), bukan nama produk kedai —
// pemetaan ke katalog borong (lib/borong-pricing.ts) dibuat admin di /admin/borong, tidak diteka kod.
// Pure (klien & server). Disimpan di app_settings.wholesale_sheet (wholesale-sheet-server.ts).
// Corak sama lib/gift-cost-sheet.ts (parser CSV dikongsi).
import { parseCsv, parseRm, r2 } from '@/lib/gift-cost-sheet'
import { BORONG_CATALOG, type BorongCatalogEntry, type BorongGroup } from '@/lib/borong-pricing'

export const WHOLESALE_SHEET_KEY = 'wholesale_sheet'
export const WHOLESALE_SHEET_EDIT_URL = 'https://docs.google.com/spreadsheets/d/1eSIohPzOB3SDYk7JPa5O37WvqkI7hWREUBEPi_JpA9A/edit?gid=370660936#gid=370660936'

export interface WholesaleTier { label: string; minCtn: number; maxCtn: number | null; price: number; profit: number; margin_pct: number }
export interface WholesaleSheetRow {
  jenis: string        // "Ajwa" | "Safawi" | "Mariami" | "Libya" | "Medjoul"
  gred: string         // gred supplier ("AA", "AA Premium", "Large"); "Tiada gred" → ''
  ctn_kg: number       // berat karton (5 | 6)
  cost_kg: number      // kos kurma RM/kg
  cost_kurma: number   // kos kurma / karton
  reserve: number      // rizab operasi / karton
  cost_base: number    // kos asas = kos kurma + rizab
  tiers: WholesaleTier[]   // ikut susunan sheet; tier 1 = harga "dari" di LP
}
export interface WholesaleSheet {
  version: string; source_gid: string; fetched_at: string
  rows: WholesaleSheetRow[]
  tier_labels: string[]
  jenis: string[]      // urutan muncul
  /** Parameter sheet (B4, B40–B46) bila dijumpai — paparan rujukan sahaja. */
  params: Partial<{ reserve: number; margin_t2_pct: number; margin_t3_pct: number; round_to: number; marketing_t2: number; marketing_t3: number }>
}

const DEFAULT_TIERS: { label: string; minCtn: number; maxCtn: number | null }[] = [
  { label: '1–2 karton', minCtn: 1, maxCtn: 2 }, { label: '3–9 karton', minCtn: 3, maxCtn: 9 }, { label: '10+ karton', minCtn: 10, maxCtn: null },
]

/** "TIER 1: 1–2 KARTON" → { label '1–2 karton', min 1, max 2 }; "TIER 3: 10+ KARTON" → max null. */
function parseTierHead(s: string): { label: string; minCtn: number; maxCtn: number | null } | null {
  if (!/^tier\s*\d/i.test(s)) return null
  const body = s.replace(/^tier\s*\d+\s*:?/i, '').trim()
  const range = body.match(/(\d+)\s*[–-]\s*(\d+)/)
  if (range) return { label: body.toLowerCase(), minCtn: Number(range[1]), maxCtn: Number(range[2]) }
  const plus = body.match(/(\d+)\s*\+/)
  if (plus) return { label: body.toLowerCase(), minCtn: Number(plus[1]), maxCtn: null }
  return null
}

/** Tukar CSV tab "Harga Wholesale 2027" → WholesaleSheet. Header dikesan ikut nama lajur ("Gred supplier");
 *  setiap lajur "Harga jual" = satu tier, untung & margin = lajur berikutnya sebelum tier seterusnya;
 *  label tier dari baris kumpulan di atas header ("TIER 1: 1–2 KARTON"), gagal → lalai 1–2/3–9/10+. */
export function parseWholesaleSheetCsv(csv: string, meta: { version?: string; source_gid?: string } = {}): WholesaleSheet {
  const grid = parseCsv(csv).map(r => r.map(c => c.trim()))
  const headerIdx = grid.findIndex(r => r.some(c => /gred supplier/i.test(c)))
  if (headerIdx < 0) throw new Error('Header "Gred supplier" tidak dijumpai — pastikan tab Harga Wholesale')
  const header = grid[headerIdx].map(h => h.toLowerCase().replace(/\s+/g, ' '))   // sel header ada baris baru
  const col = (re: RegExp) => header.findIndex(h => re.test(h))
  const C = { jenis: col(/^jenis/), gred: col(/gred supplier/), costKg: col(/kos\/kg/), ctnKg: col(/berat\/karton/), costKurma: col(/kos kurma/), reserve: col(/rizab/), costBase: col(/kos asas/) }
  for (const [k, v] of Object.entries(C)) if (v < 0) throw new Error(`Lajur "${k}" tidak dijumpai dalam header sheet`)
  const priceCols = header.map((h, i) => (/harga jual/.test(h) ? i : -1)).filter(i => i >= 0)
  if (!priceCols.length) throw new Error('Lajur "Harga jual" tidak dijumpai')
  const after = (from: number, re: RegExp) => { const end = priceCols.find(p => p > from) ?? header.length; for (let i = from + 1; i < end; i++) if (re.test(header[i])) return i; return -1 }
  const tierCols = priceCols.map(p => ({ price: p, profit: after(p, /untung/), margin: after(p, /^margin/) }))
  const heads = (grid[headerIdx - 1] ?? []).map(parseTierHead).filter((x): x is NonNullable<typeof x> => !!x)
  const bounds = heads.length === tierCols.length ? heads : DEFAULT_TIERS.slice(0, tierCols.length)

  const rows: WholesaleSheetRow[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i]
    const jenis = r[C.jenis] ?? '', gredRaw = r[C.gred] ?? ''
    if (!jenis || !gredRaw) continue   // baris nota/parameter di bawah jadual tiada gred
    const costBase = parseRm(r[C.costBase]), costKurma = parseRm(r[C.costKurma]), reserve = parseRm(r[C.reserve])
    const tiers: WholesaleTier[] = []
    tierCols.forEach((tc, ti) => {
      const price = parseRm(r[tc.price])
      if (!Number.isFinite(price) || price <= 0) return
      const profitRaw = tc.profit >= 0 ? parseRm(r[tc.profit]) : NaN, marginRaw = tc.margin >= 0 ? parseRm(r[tc.margin]) : NaN
      const profit = Number.isFinite(profitRaw) ? r2(profitRaw) : Number.isFinite(costBase) ? r2(price - costBase) : 0
      const margin_pct = Number.isFinite(marginRaw) ? r2(marginRaw) : price > 0 ? r2(profit / price * 100) : 0
      const b = bounds[ti] ?? DEFAULT_TIERS[ti] ?? { label: `tier ${ti + 1}`, minCtn: 1, maxCtn: null }
      tiers.push({ label: b.label, minCtn: b.minCtn, maxCtn: b.maxCtn, price: r2(price), profit, margin_pct })
    })
    if (!tiers.length) continue
    rows.push({
      jenis, gred: /^tiada/i.test(gredRaw) ? '' : gredRaw,
      ctn_kg: parseRm(r[C.ctnKg]) || 0, cost_kg: parseRm(r[C.costKg]) || 0,
      cost_kurma: Number.isFinite(costKurma) ? r2(costKurma) : 0, reserve: Number.isFinite(reserve) ? r2(reserve) : 0, cost_base: Number.isFinite(costBase) ? r2(costBase) : 0,
      tiers,
    })
  }
  if (!rows.length) throw new Error('Tiada baris harga dibaca dari sheet')

  // Parameter: label di lajur A, nilai di lajur B (mana-mana baris)
  const params: WholesaleSheet['params'] = {}
  const P: [RegExp, keyof WholesaleSheet['params']][] = [
    [/^rizab\/karton/i, 'reserve'], [/margin direct tier 2/i, 'margin_t2_pct'], [/margin direct tier 3/i, 'margin_t3_pct'],
    [/^bundar harga/i, 'round_to'], [/marketing tier 2/i, 'marketing_t2'], [/marketing tier 3/i, 'marketing_t3'],
  ]
  for (const r of grid) for (const [re, key] of P) if (re.test(r[0] ?? '')) { const v = parseRm(r[1]); if (Number.isFinite(v)) params[key] = v }

  return {
    version: meta.version ?? '2027', source_gid: meta.source_gid ?? '', fetched_at: new Date().toISOString(),
    rows, tier_labels: bounds.map(b => b.label), jenis: [...new Set(rows.map(r => r.jenis))], params,
  }
}

const kgLabel = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
/** "Ajwa AA · 5kg" — label pendek untuk jadual admin. */
export const wholesaleRowName = (r: Pick<WholesaleSheetRow, 'jenis' | 'gred' | 'ctn_kg'>) => `${r.jenis}${r.gred ? ` ${r.gred}` : ''} · ${kgLabel(r.ctn_kg)}kg`
/** Nama item sebut harga/invois. */
export const wholesaleItemName = (r: Pick<WholesaleSheetRow, 'jenis' | 'gred' | 'ctn_kg'>) => `Kurma ${r.jenis}${r.gred ? ` ${r.gred}` : ''} — karton ${kgLabel(r.ctn_kg)}kg (borong)`
export const wholesaleRowKey = (r: Pick<WholesaleSheetRow, 'jenis' | 'gred' | 'ctn_kg'>) => `${r.jenis}|${r.gred}|${r.ctn_kg}`

/** Tier ikut bilangan karton: tier terbesar yang minCtn ≤ qty; bawah tier pertama → tier pertama. */
export function wholesaleTierFor(r: WholesaleSheetRow, qtyCtn: number): WholesaleTier | null {
  if (!r.tiers.length) return null
  let best = r.tiers[0]
  for (const t of r.tiers) if (qtyCtn >= t.minCtn) best = t
  return best
}

/** Kumpulan katalog borong untuk "Jenis" sheet. */
export function borongGroupFor(jenis: string): BorongGroup | null {
  const j = jenis.toLowerCase()
  if (j.includes('ajwa')) return 'ajwa'
  if (j.includes('mariami')) return 'mariami'
  if (j.includes('safawi')) return 'safawi'
  if (j.includes('medjoul') || j.includes('medjool')) return 'medjoul'
  if (j.includes('sukkari')) return 'sukkari'
  if (j.includes('tunisia')) return 'tunisia'
  if (j.includes('libya')) return 'lain'
  return null
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Cadangan slug katalog untuk baris sheet: kumpulan + berat karton sama, slug mengandungi jenis (bila ada), dan gred
 *  padan TEPAT (atau gred sheet ialah perkataan penuh dalam gred katalog, cth "VIP" → "Super Jumbo VIP").
 *  Tiada padanan pasti → null — admin pilih sendiri; kod tidak meneka (gred sheet = gred supplier). */
export function suggestCatalogSlug(r: WholesaleSheetRow, catalog: readonly BorongCatalogEntry[] = BORONG_CATALOG): string | null {
  const g = borongGroupFor(r.jenis)
  if (!g) return null
  const jenisWord = r.jenis.toLowerCase().split(/\s+/)[0]
  let cands = catalog.filter(e => e.group === g && e.packKg === r.ctn_kg)
  const byName = cands.filter(e => e.slug.includes(jenisWord))
  if (byName.length) cands = byName
  const gred = r.gred.toLowerCase()
  if (!gred) return cands.length === 1 ? cands[0].slug : null
  const exact = cands.find(e => e.grade.toLowerCase() === gred)
  if (exact) return exact.slug
  const word = cands.filter(e => new RegExp(`\\b${escRe(gred)}\\b`, 'i').test(e.grade))
  return word.length === 1 ? word[0].slug : null
}
