// Sheet harga gift box pemilik — kini "MASTER HARGA KURMA 2027" › tab "Harga Giftbox 2027" (dulu
// "GIFT BOX CUSTOM 2026"): kos & harga per kategori × kurma × berat × tier kuantiti. Ini rujukan
// team sale untuk tentukan harga terbaik. Pure (klien & server).
// Bentuk disimpan di app_settings.gift_cost_sheet (lihat gift-cost-sheet-server.ts).

export const GIFT_COST_SHEET_KEY = 'gift_cost_sheet'
export const GIFT_COST_SHEET_EDIT_URL = 'https://docs.google.com/spreadsheets/d/1eSIohPzOB3SDYk7JPa5O37WvqkI7hWREUBEPi_JpA9A/edit?gid=7112027#gid=7112027'

export interface GiftSheetCost { kurma: number; ziplock: number; upah: number; lain: number; kotak: number; komisyen: number }
export interface GiftSheetRow {
  category?: string        // 2027: "Ready-made" | "Custom kuantiti kecil" | "Custom pukal"; tiada pada data 2026 lama
  kurma: string            // "Mariami A", "Libya / Tunisia", "Ajwa Medium/A (PROMO)"
  weight: string           // "100g" | "150g" | "200g" | "250g" | "500g" | "1000g"
  qty: number              // tier kuantiti kotak (1 | 10 | 50 | … | 2000)
  cost: GiftSheetCost
  total_cost: number       // Total Kos Per Box (RM)
  price: number            // Harga jual per kotak (RM)
  profit: number           // Profit 1pcs (RM)
  margin_pct: number       // % PROFIT (untung / harga × 100)
}
export interface GiftSheetBand { qty_label: string; margin_label: string }
export interface GiftCostSheet {
  version: string          // "2026"
  source_gid: string
  fetched_at: string
  rows: GiftSheetRow[]
  bands: GiftSheetBand[]   // panduan margin sasaran ikut kuantiti (dari sheet)
  kurma: string[]          // urutan muncul
  weights: string[]
  categories?: string[]    // urutan muncul (2027); tiada/kosong = sheet tanpa kategori
  has_komisyen?: boolean   // sheet ada lajur komisyen? (2026 ya, 2027 tiada → kalkulator jangan auto-tambah 2%)
}

export const r2 = (n: number) => Math.round(n * 100) / 100
/** "RM1,010.00" | "-RM4.16" | "33.67%" → nombor; teks lain → NaN */
export function parseRm(v: string | undefined | null): number {
  if (v == null) return NaN
  const cleaned = String(v).replace(/[^0-9.]/g, '')
  if (!cleaned) return NaN                      // sel kosong → NaN (bukan 0) supaya carry-forward berfungsi
  const neg = /^-|\(.*\)/.test(v.trim())
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return NaN
  return neg ? -n : n
}

/** Padan kategori: undefined/null = abaikan (data 2026 tanpa kategori); '' = baris tanpa kategori sahaja. */
const inCategory = (r: GiftSheetRow, category: string | null | undefined) => category == null || (r.category ?? '') === category

/** Baris tier terbaik untuk kuantiti: tier terbesar ≤ qty; jika qty bawah tier terkecil → tier terkecil.
 *  Sheet 2027 ada kurma+berat sama dalam beberapa kategori — hantar `category` supaya tier tak bercampur. */
export function findSheetRow(sheet: GiftCostSheet | null | undefined, kurma: string, weight: string, qty: number, category?: string | null): GiftSheetRow | null {
  if (!sheet) return null
  const rows = sheet.rows.filter(r => r.kurma === kurma && r.weight === weight && inCategory(r, category)).sort((a, b) => a.qty - b.qty)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (r.qty <= qty) best = r
  return best
}
export function sheetTiers(sheet: GiftCostSheet | null | undefined, kurma: string, weight: string, category?: string | null): GiftSheetRow[] {
  return (sheet?.rows ?? []).filter(r => r.kurma === kurma && r.weight === weight && inCategory(r, category)).sort((a, b) => a.qty - b.qty)
}
/** Nama item sebut harga ikut kategori: Ready-made ≠ custom berlogo. */
export const sheetItemName = (r: Pick<GiftSheetRow, 'kurma' | 'weight' | 'category'>) => {
  const c = (r.category ?? '').toLowerCase()
  const base = c.startsWith('ready') ? `Gift Box Ready-made ${r.weight} — ${r.kurma}` : `Custom Gift Box ${r.weight} — ${r.kurma}`
  return c.includes('kecil') ? `${base} (kuantiti kecil)` : base
}
export const marginPct = (price: number, cost: number) => price > 0 ? r2(((price - cost) / price) * 100) : 0

// ── Parser CSV (petikan & koma dalam sel) ─────────────────────────────────
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row) }
  return rows
}

/** Tukar CSV tab harga gift box → GiftCostSheet. Sokong dua format header:
 *  • 2026 "GIFT BOX CUSTOM 2026": Harga · Total Kos Per Box · Profit 1pcs · % PROFIT · ada lajur komisyen
 *  • 2027 "Harga Giftbox 2027": Kategori · Harga jual/unit · Jumlah kos/unit · Untung/unit · Margin (%) · tiada komisyen;
 *    berat ditulis gram tanpa unit ("100", "1,000") → dinormalkan ke "100g"/"1000g".
 *  Header dikesan ikut nama lajur; kategori/kurma/berat dibawa ke bawah bila sel kosong. */
export function parseGiftCostSheetCsv(csv: string, meta: { version?: string; source_gid?: string } = {}): GiftCostSheet {
  const grid = parseCsv(csv).map(r => r.map(c => c.trim()))
  const headerIdx = grid.findIndex(r => r.some(c => /jenis kurma/i.test(c)))
  if (headerIdx < 0) throw new Error('Header "Jenis Kurma" tidak dijumpai — pastikan tab yang betul')
  const header = grid[headerIdx].map(h => h.toLowerCase().replace(/\s+/g, ' '))   // header 2027 ada baris baru dalam sel
  const col = (re: RegExp) => header.findIndex(h => re.test(h))
  const C = {
    kurma: col(/jenis kurma/), weight: col(/^berat/), kKurma: col(/kos kurma/), ziplock: col(/ziplock/), upah: col(/kos upah/), lain: col(/lain-lain|lain lain|kos lain/),
    kotak: col(/kos kotak/), qty: col(/kuantiti/), total: col(/total kos per box|jumlah kos\/unit/), price: col(/^harga$|harga jual/),
  }
  for (const [k, v] of Object.entries(C)) if (v < 0) throw new Error(`Lajur "${k}" tidak dijumpai dalam header sheet`)
  // Pilihan — tak semua format ada
  const O = { komisyen: col(/komisyen/), profit: col(/profit 1pcs|untung\/unit/), pct: col(/% profit|^margin/), category: col(/^kategori$/) }
  const normWeight = (v: string) => { const s = v.replace(/[\s,]+/g, '').toLowerCase(); return /^\d+$/.test(s) ? `${s}g` : s }

  const rows: GiftSheetRow[] = []
  const bands: GiftSheetBand[] = []
  let kurma = '', weight = '', category = ''
  let bandCols: [number, number] | null = null
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i]
    // Panduan margin (2026): header "Order Quantity | Margin Sasaran" di mana-mana lajur kanan
    const oq = r.findIndex(c => /order quantity/i.test(c))
    if (oq >= 0) { bandCols = [oq, oq + 1]; continue }
    if (bandCols && r[bandCols[0]] && r[bandCols[1]] && /pcs|unit|kotak/i.test(r[bandCols[0]])) bands.push({ qty_label: r[bandCols[0]], margin_label: r[bandCols[1]] })

    if (O.category >= 0 && r[O.category]) category = r[O.category]
    if (r[C.kurma]) kurma = r[C.kurma]
    if (r[C.weight]) weight = normWeight(r[C.weight])
    const qty = Number(String(r[C.qty] ?? '').replace(/[^0-9]/g, ''))
    if (!kurma || !weight || !qty) continue
    const price = parseRm(r[C.price]); const total = parseRm(r[C.total])
    if (!Number.isFinite(price) || !Number.isFinite(total)) continue
    // Kos kurma/ziplock/upah/lain hanya pada baris pertama setiap berat (2026) → bawa ke bawah dalam kumpulan sama
    const prev = rows.length ? rows[rows.length - 1] : null
    const sameGroup = !!prev && prev.kurma === kurma && prev.weight === weight && (prev.category ?? '') === category
    const carry = (idx: number, key: keyof GiftSheetCost) => { const v = parseRm(r[idx]); return Number.isFinite(v) ? v : (sameGroup ? prev!.cost[key] : 0) }
    const cost: GiftSheetCost = { kurma: carry(C.kKurma, 'kurma'), ziplock: carry(C.ziplock, 'ziplock'), upah: carry(C.upah, 'upah'), lain: carry(C.lain, 'lain'), kotak: parseRm(r[C.kotak]) || 0, komisyen: O.komisyen >= 0 ? parseRm(r[O.komisyen]) || 0 : 0 }
    const profit = O.profit >= 0 ? parseRm(r[O.profit]) : NaN; const pct = O.pct >= 0 ? parseRm(r[O.pct]) : NaN
    rows.push({ ...(category ? { category } : {}), kurma, weight, qty, cost, total_cost: r2(total), price: r2(price), profit: Number.isFinite(profit) ? r2(profit) : r2(price - total), margin_pct: Number.isFinite(pct) ? r2(pct) : marginPct(price, total) })
  }
  if (!rows.length) throw new Error('Tiada baris harga dibaca dari sheet')
  const uniq = (xs: string[]) => [...new Set(xs)]
  const categories = uniq(rows.map(r => r.category ?? '').filter(Boolean))
  return {
    version: meta.version ?? '2027', source_gid: meta.source_gid ?? '', fetched_at: new Date().toISOString(), rows, bands,
    kurma: uniq(rows.map(r => r.kurma)), weights: uniq(rows.map(r => r.weight)),
    ...(categories.length ? { categories } : {}), has_komisyen: O.komisyen >= 0,
  }
}
