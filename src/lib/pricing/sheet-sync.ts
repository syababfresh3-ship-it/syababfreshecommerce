// Fasa 2 — Enjin cadangan kos: baca Google Sheet invois (CSV export) → kira kos
// landed terkini per buah (CFR + clearance untuk import) → cadang kemas kini
// variant_costs.kos_buah. CADANG sahaja; admin sahkan sebelum ditulis.
//
// Logik padanan buah→variant diadaptasi dari scripts/update-kos-from-sheet.mjs,
// tapi harga diambil LIVE dari sheet (bukan hardcoded).
import type { SupabaseClient } from '@supabase/supabase-js'

const CSV_URL_DEFAULT =
  'https://docs.google.com/spreadsheets/d/1bA2WdOQQZFXlQoJdDhbL9b_iZSt8JfBAYBd_lIuLw2w/export?format=csv&gid=1015346788'

const COL = {
  tarikh: 'Tarikh Invois',
  kategori: 'Kategori',
  item: 'Item',
  kosKg: 'Kos/kg (RM)',
  jumlah: 'Jumlah (RM)',
} as const

// Baris BUKAN buah (dikecualikan bila cari kos buah).
const NON_FRUIT = /transport|packaging|lesen|deposit|import\s*cost|penginapan/i

type Unit = 'kg' | 'biji' | 'ctn'
interface Rule {
  nama: string
  productRe: RegExp // padan nama produk website (tentukan variant mana dikemaskini)
  sheetRe: RegExp // padan Item dalam sheet (cari baris kos)
  unit: Unit
  clearanceRe?: RegExp // import: padan baris Kategori 'Transport' untuk kos clearance/kg
}

// Nota: productRe padan nama produk website; sheetRe padan teks Item sheet.
// clearanceRe hanya untuk buah import udara (ceri/peach/aprikot Uzbek).
const RULES: Rule[] = [
  { nama: 'Ceri Turki (landed)', productRe: /ceri\s*turk|cherry\s*turk|ceri(?!.*usa)/i, sheetRe: /ziraat|cherry\s*turk|ceri\s*turk/i, unit: 'kg', clearanceRe: /cherr|ceri/i },
  { nama: 'Ceri USA', productRe: /ceri\s*usa|cherry\s*usa/i, sheetRe: /usa.*cherry|cherry.*usa|usa.*red\s*cherry|sweet\s*heart/i, unit: 'kg' },
  { nama: 'Donut Peach (landed)', productRe: /donut\s*peach|peach/i, sheetRe: /donut\s*peach|flat\s*peach|peach/i, unit: 'kg', clearanceRe: /peach|aprikot|uzbek/i },
  { nama: 'Aprikot (landed)', productRe: /^(?!.*kering)(?=.*(aprikot|apricot))/i, sheetRe: /aprikot|apricot|orange\s*rubis/i, unit: 'kg', clearanceRe: /peach|aprikot|uzbek/i },
  { nama: 'Sweet Globe (hijau)', productRe: /sweet\s*globe/i, sheetRe: /sweet\s*globe/i, unit: 'kg' },
  { nama: 'Shine Muscat', productRe: /shine\s*muscat/i, sheetRe: /shine\s*muscat/i, unit: 'kg' },
  { nama: 'Sweet Sapphire', productRe: /sweet\s*sapphire/i, sheetRe: /sweet\s*sapphire/i, unit: 'kg' },
  { nama: 'Sugarone', productRe: /sugarone/i, sheetRe: /sugarone/i, unit: 'kg' },
  { nama: 'Crimson (merah)', productRe: /crimson/i, sheetRe: /crimson/i, unit: 'kg' },
  { nama: 'Adora (hitam)', productRe: /adora/i, sheetRe: /adora/i, unit: 'kg' },
  { nama: 'Navel Orange', productRe: /navel\s*orange|oren\s*navel/i, sheetRe: /navel/i, unit: 'kg' },
  { nama: 'Mandarin', productRe: /mandarin/i, sheetRe: /mandarin/i, unit: 'kg' },
  { nama: 'Strawberry', productRe: /strawberry|strawberi/i, sheetRe: /strawberry/i, unit: 'kg' },
  { nama: 'Blueberry', productRe: /blueberry|blueberi/i, sheetRe: /blueberry/i, unit: 'kg' },
  { nama: 'Lychee', productRe: /lychee|laici/i, sheetRe: /lychee|laici/i, unit: 'kg' },
  { nama: 'Avocado', productRe: /avocado|avokado/i, sheetRe: /avocado/i, unit: 'kg' },
  { nama: 'Manggis', productRe: /manggis/i, sheetRe: /manggis/i, unit: 'kg' },
  { nama: 'Rambutan', productRe: /rambutan/i, sheetRe: /rambutan/i, unit: 'kg' },
  { nama: 'Jambu Batu', productRe: /jambu\s*batu/i, sheetRe: /jambu/i, unit: 'kg' },
  { nama: 'Longan', productRe: /longan/i, sheetRe: /longan/i, unit: 'kg' },
  { nama: 'Musang King', productRe: /musang\s*king|durian/i, sheetRe: /musang|durian/i, unit: 'kg' },
  { nama: 'Melon', productRe: /melon/i, sheetRe: /melon/i, unit: 'biji' },
  { nama: 'Delima', productRe: /delima|pomegranate/i, sheetRe: /delima|pomegranate/i, unit: 'biji' },
  { nama: 'Gold Kiwi', productRe: /gold\s*kiwi|kiwi/i, sheetRe: /kiwi/i, unit: 'biji' },

  // ── Tambahan: buah yang ada dalam sheet invois tapi belum ada rule ───────────
  // Diletak di HUJUNG supaya keutamaan rule sedia ada tidak berubah langsung.
  // 'Cherry Fresh Turki …' tak padan rule Ceri Turki di atas kerana ada perkataan
  // di antara "Cherry" dan "Turki" — rule alt ini tangkap ejaan tersebut.
  { nama: 'Ceri Turki (ejaan alt)', productRe: /cherry.*turki|ceri.*turki/i, sheetRe: /ziraat|cherry\s*turk|ceri\s*turk/i, unit: 'kg', clearanceRe: /cherr|ceri/i },
  { nama: 'Winter Jujube', productRe: /jujube|bidara/i, sheetRe: /jujube/i, unit: 'kg' },
  { nama: 'Red Plum', productRe: /red\s*plum|plum/i, sheetRe: /red\s*plum|plum/i, unit: 'kg' },
  { nama: 'Pulasan', productRe: /pulasan/i, sheetRe: /pulasan/i, unit: 'kg' },
  { nama: 'Buah Naga', productRe: /buah\s*naga|dragon\s*fruit/i, sheetRe: /buah\s*naga|dragon\s*fruit/i, unit: 'kg' },
  { nama: 'Mangga Chokanan', productRe: /chokanan|chokonan/i, sheetRe: /chokonan|chokanan/i, unit: 'kg' },
  { nama: 'Keledek Vietnam', productRe: /sweet\s*potato\s*vietnam|keledek\s*vietnam/i, sheetRe: /vietnam\s*sweet\s*potato/i, unit: 'kg' },
  { nama: 'Packham Pear', productRe: /packham/i, sheetRe: /packham/i, unit: 'biji' },
  { nama: 'Century Pear', productRe: /century\s*pear/i, sheetRe: /century\s*pear/i, unit: 'biji' },
  { nama: 'Forelle Pear', productRe: /forelle|forella/i, sheetRe: /forelle|forella/i, unit: 'biji' },
  { nama: 'Lemon', productRe: /^lemon/i, sheetRe: /lemon/i, unit: 'biji' },
]

// ── CSV parser (RFC4180 ringkas: handle petik & koma/newline dalam field) ──────
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

export type SheetRow = Record<string, string>

export async function fetchSheetRows(): Promise<SheetRow[]> {
  const url = process.env.PRICING_SHEET_CSV_URL || CSV_URL_DEFAULT
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store' })
  if (!res.ok) throw new Error(`Gagal baca sheet (HTTP ${res.status})`)
  const grid = parseCsv(await res.text())
  if (!grid.length) return []
  const header = grid[0].map((h) => h.trim())
  return grid
    .slice(1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => {
      const o: SheetRow = {}
      header.forEach((h, i) => { o[h] = (r[i] ?? '').trim() })
      return o
    })
}

const numOf = (s: string | undefined) => {
  const n = parseFloat(String(s ?? '').replace(/[^0-9.]/g, ''))
  return isFinite(n) ? n : 0
}

// Kos buah per-unit terkini (purata berwajaran ikut Jumlah, pada tarikh invois terbaru).
function latestFruitCost(rows: SheetRow[], rule: Rule) {
  const matches = rows.filter(
    (r) => rule.sheetRe.test(r[COL.item] || '') && !NON_FRUIT.test(r[COL.kategori] || '') && !NON_FRUIT.test(r[COL.item] || '') && numOf(r[COL.kosKg]) > 0,
  )
  if (!matches.length) return null
  const latest = matches.reduce((a, b) => ((b[COL.tarikh] || '') > (a[COL.tarikh] || '') ? b : a))[COL.tarikh]
  const onLatest = matches.filter((r) => r[COL.tarikh] === latest)
  let wsum = 0, w = 0
  for (const r of onLatest) {
    const k = numOf(r[COL.kosKg]); const j = numOf(r[COL.jumlah]) || 1
    if (k > 0) { wsum += k * j; w += j }
  }
  return { perUnit: w ? wsum / w : 0, tarikh: latest, item: onLatest[0][COL.item] }
}

// Kos clearance/kg terkini untuk buah import (baris Kategori 'Transport').
function latestClearance(rows: SheetRow[], rule: Rule): number {
  if (!rule.clearanceRe) return 0
  const matches = rows.filter(
    (r) => /transport/i.test(r[COL.kategori] || '') && rule.clearanceRe!.test(r[COL.item] || '') && numOf(r[COL.kosKg]) > 0,
  )
  if (!matches.length) return 0
  const latest = matches.reduce((a, b) => ((b[COL.tarikh] || '') > (a[COL.tarikh] || '') ? b : a))[COL.tarikh]
  const on = matches.filter((r) => r[COL.tarikh] === latest)
  return numOf(on[on.length - 1][COL.kosKg])
}

// ── Skala kos per-unit ke variant ─────────────────────────────────────────────
interface Variant { id: string; product_id: string; name: string | null; weight_grams: number | null }

function beratKg(v: Variant): number | null {
  if (v.weight_grams && v.weight_grams > 0) return v.weight_grams / 1000
  const t = (v.name ?? '').toLowerCase().replace(/\s/g, '')
  const kg = t.match(/(\d+(?:\.\d+)?)kg/)
  if (kg) return parseFloat(kg[1])
  const g = t.match(/(\d+(?:\.\d+)?)g(?!r)/)
  if (g) return parseFloat(g[1]) / 1000
  return null
}
// Produk tanpa variant: berat diambil dari products.weight_grams (atau nama produk).
// Sebelum ini produk begini sentiasa dilangkau kerana berat hanya dibaca dari variant.
function beratKgProduk(p: { name: string; weight_grams?: number | null }): number | null {
  if (p.weight_grams && p.weight_grams > 0) return p.weight_grams / 1000
  return beratKg({ id: '', product_id: '', name: p.name, weight_grams: null })
}

function countOf(v: Variant, unit: string): number | null {
  const t = (v.name ?? '').toLowerCase()
  const m = t.match(new RegExp(`(\\d+)\\s*${unit}`))
  return m ? parseInt(m[1], 10) : null
}

export interface Suggestion {
  product_id: string
  variant_id: string | null
  nama: string
  variantNama: string | null
  kos_buah_lama: number | null
  kos_buah_baru: number
  breakdown: { cfr: number; clearance: number; landed: number; rule: string; tarikh: string; item_sheet: string; unit: Unit }
}
export interface SkipInfo { apa: string; sebab: string }

// Bina senarai cadangan: banding kos landed dari sheet vs variant_costs.kos_buah semasa.
export async function buildSuggestions(
  supabase: SupabaseClient,
): Promise<{ suggestions: Suggestion[]; skipped: SkipInfo[]; sheetRows: number }> {
  const rows = await fetchSheetRows()

  const [{ data: products }, { data: variants }, { data: costs }] = await Promise.all([
    supabase.from('products').select('id, name, weight_grams, is_active').eq('is_active', true),
    supabase.from('product_variants').select('id, product_id, name, weight_grams, is_active').eq('is_active', true),
    supabase.from('variant_costs').select('product_id, variant_id, kos_buah'),
  ])

  const costByKey = new Map<string, number>()
  for (const c of costs ?? []) costByKey.set(`${c.product_id}:${c.variant_id ?? 'null'}`, Number(c.kos_buah))

  const variantsByProduct = new Map<string, Variant[]>()
  for (const v of (variants ?? []) as Variant[]) {
    const list = variantsByProduct.get(v.product_id) ?? []
    list.push(v)
    variantsByProduct.set(v.product_id, list)
  }

  const suggestions: Suggestion[] = []
  const skipped: SkipInfo[] = []

  for (const p of (products ?? []) as { id: string; name: string; weight_grams?: number | null }[]) {
    const rule = RULES.find((r) => r.productRe.test(p.name))
    // Dulu produk tanpa rule dilangkau SENYAP — admin tak tahu ia tak disemak.
    // Sekarang ia dilaporkan supaya sebab 'tiada cadangan' jelas.
    if (!rule) { skipped.push({ apa: p.name, sebab: 'tiada rule padanan — buah ini tak disemak dari sheet' }); continue }
    const fc = latestFruitCost(rows, rule)
    if (!fc) { skipped.push({ apa: p.name, sebab: `kos '${rule.nama}' tak dijumpai dalam sheet` }); continue }
    const clearance = latestClearance(rows, rule)
    const perUnitLanded = Math.round((fc.perUnit + clearance) * 10000) / 10000

    const vs = variantsByProduct.get(p.id) ?? []
    const targets: (Variant | null)[] = vs.length > 0 ? vs : [null]

    for (const v of targets) {
      let scaled: number | null = null
      if (rule.unit === 'kg') {
        const kg = v ? beratKg(v) : beratKgProduk(p)
        if (kg) scaled = perUnitLanded * kg
        else { skipped.push({ apa: `${p.name} / ${v?.name ?? '(produk)'}`, sebab: v ? 'berat variant tak dapat ditentukan' : 'berat produk (weight_grams) belum diisi' }); continue }
      } else if (rule.unit === 'ctn') {
        const n = v ? (countOf(v, 'ctn') ?? countOf(v, 'kotak')) : null
        if (n) scaled = perUnitLanded * n
        else { skipped.push({ apa: `${p.name} / ${v?.name ?? '(produk)'}`, sebab: 'bilangan ctn tak jelas' }); continue }
      } else {
        const n = v ? (countOf(v, 'biji') ?? countOf(v, 'pcs') ?? countOf(v, 'pack')) : null
        if (n) scaled = perUnitLanded * n
        else { skipped.push({ apa: `${p.name} / ${v?.name ?? '(produk)'}`, sebab: 'bilangan biji/pcs tak jelas' }); continue }
      }

      const kosBaru = Math.round(scaled * 100) / 100
      const key = `${p.id}:${v ? v.id : 'null'}`
      const kosLama = costByKey.has(key) ? costByKey.get(key)! : null
      if (kosLama != null && Math.abs(kosLama - kosBaru) <= 0.01) continue // tiada perubahan bermakna

      suggestions.push({
        product_id: p.id,
        variant_id: v ? v.id : null,
        nama: p.name,
        variantNama: v ? v.name : null,
        kos_buah_lama: kosLama,
        kos_buah_baru: kosBaru,
        breakdown: {
          cfr: Math.round(fc.perUnit * 100) / 100,
          clearance: Math.round(clearance * 100) / 100,
          landed: Math.round(perUnitLanded * 100) / 100,
          rule: rule.nama,
          tarikh: fc.tarikh,
          item_sheet: fc.item,
          unit: rule.unit,
        },
      })
    }
  }

  return { suggestions, skipped, sheetRows: rows.length }
}
