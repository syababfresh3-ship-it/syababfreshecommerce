// ============================================================
// hermes-sheet — baca log invois pembekal "Hermes" (Google Sheet, tab CSV awam) dan
// susun baris menjadi mesej "buah baru masuk" untuk kumpulan WhatsApp staf.
//
// Lajur sheet (header sebenar, 24 Nov 2026): Tarikh Log · Tarikh Invois · Company · No Invois ·
// Kategori · Item · Qty · Unit · Harga/Unit (RM) · Berat/Unit (kg) · Kos/kg (RM) · Jumlah (RM) · Catatan
//
// Nota semantik (ikut amalan sheet):
//   - Kategori KOSONG = baris pendua yang dibatalkan → abaikan.
//   - Kategori bukan buah (transport, import cost, packaging, lesen, deposit…) → abaikan.
//   - Bila Catatan/Unit sebut "biji", "pack", "bukan kg": Berat/Unit ialah BILANGAN (biji/pack) dan
//     "Kos/kg" sebenarnya kos SEUNIT itu. Jika tidak: Berat/Unit = kg setiap ctn, Kos/kg = RM/kg.
// Kunci baris (untuk kesan baharu) TIDAK termasuk Catatan — Hermes selalu kemas kini nota kemudian.
// Tulen — tiada DB di sini. Dipakai oleh /api/cron/hermes-stock-in.
// ============================================================
import { createHash } from 'crypto'

const SHEET_ID = process.env.HERMES_SHEET_ID?.trim() || '1bA2WdOQQZFXlQoJdDhbL9b_iZSt8JfBAYBd_lIuLw2w'
const SHEET_GID = process.env.HERMES_SHEET_GID?.trim() || '1015346788'
export const HERMES_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`

const NON_FRUIT = new Set(['transport', 'import cost', 'packaging', 'lesen', 'deposit', 'upah', 'minyak', 'lain-lain', 'lain', 'kos'])

export interface HermesRow {
  key: string
  logAt: string
  invoiceDate: string
  company: string
  invoiceNo: string
  category: string
  item: string
  qty: number
  unit: string
  pricePerUnit: number
  perUnit: number        // kg/ctn ATAU biji/pack per ctn (lihat perUnitKind)
  perUnitKind: 'kg' | 'biji' | 'pack'
  costPer: number        // RM per kg / biji / pack (lajur "Kos/kg (RM)")
  total: number
  note: string
}

/** Parser CSV RFC4180 ringkas: petikan, koma & baris baharu dalam petikan, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* abaikan */ }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(x => x.trim() !== ''))
}

export async function fetchHermesCsv(): Promise<{ header: string[]; rows: string[][] }> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 20_000)
  try {
    const res = await fetch(HERMES_CSV_URL, { signal: ctl.signal, cache: 'no-store', redirect: 'follow' })
    if (!res.ok) throw new Error(`sheet HTTP ${res.status}`)
    const text = await res.text()
    if (/<html/i.test(text.slice(0, 200))) throw new Error('sheet memulangkan HTML (tidak awam / had kadar)')
    const all = parseCsv(text)
    if (all.length < 1) throw new Error('CSV kosong')
    return { header: all[0].map(h => h.trim()), rows: all.slice(1) }
  } finally {
    clearTimeout(t)
  }
}

const num = (v: string | undefined) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0 }
const PIECE_RE = /\bbiji\b|bukan kg|\/\s*biji/i
const PACK_RE = /\bpack\b|\bpek\b|\/\s*pack/i

/** Tukar baris mentah kepada HermesRow; null = bukan baris buah yang sah. */
export function toHermesRow(header: string[], r: string[]): HermesRow | null {
  const col = (n: string) => header.indexOf(n)
  const TL = col('Tarikh Log'), TI = col('Tarikh Invois'), CO = col('Company'), NI = col('No Invois'), K = col('Kategori'),
    IT = col('Item'), Q = col('Qty'), U = col('Unit'), HU = col('Harga/Unit (RM)'), BU = col('Berat/Unit (kg)'), KK = col('Kos/kg (RM)'),
    J = col('Jumlah (RM)'), C = col('Catatan')
  if ([TL, TI, K, IT, Q].some(i => i < 0)) throw new Error('Header sheet Hermes berubah — lajur tak dijumpai')
  const category = (r[K] ?? '').trim()
  if (!category || NON_FRUIT.has(category.toLowerCase())) return null
  const item = (r[IT] ?? '').trim()
  const qty = num(r[Q])
  if (!item || !(qty > 0)) return null
  const note = (r[C] ?? '').trim(), unit = (r[U] ?? '').trim()
  const kind: HermesRow['perUnitKind'] = PACK_RE.test(note) || PACK_RE.test(item) ? 'pack' : (PIECE_RE.test(note) || /biji/i.test(unit)) ? 'biji' : 'kg'
  const logAt = (r[TL] ?? '').trim(), invoiceNo = (r[NI] ?? '').trim()
  const key = createHash('sha1').update([logAt, invoiceNo, item, String(qty), String(num(r[J]))].join('|')).digest('hex').slice(0, 12)
  return {
    key, logAt, invoiceDate: (r[TI] ?? '').trim().slice(0, 10), company: (r[CO] ?? '').trim(), invoiceNo, category, item, qty,
    unit: unit || 'unit', pricePerUnit: num(r[HU]), perUnit: num(r[BU]), perUnitKind: kind, costPer: num(r[KK]), total: num(r[J]), note,
  }
}

export function parseHermesRows(header: string[], rows: string[][]): HermesRow[] {
  const out: HermesRow[] = []
  for (const r of rows) { const h = toHermesRow(header, r); if (h) out.push(h) }
  return out
}

const rm2 = (n: number) => `RM${n.toFixed(2)}`
const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis']
export function fmtDate(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10) - 1] ?? m[2]}` : ymd
}

/** Satu baris item untuk mesej. withCost=false → tiada harga/kos langsung. */
export function describeRow(r: HermesRow, withCost: boolean): string {
  const per = r.perUnit > 0 ? (r.perUnitKind === 'kg' ? `${r.perUnit % 1 ? r.perUnit.toFixed(1) : r.perUnit}kg` : `${Math.round(r.perUnit)} ${r.perUnitKind}`) : ''
  const q = `${r.qty % 1 ? r.qty.toFixed(1) : r.qty} ${r.unit}${per ? ` × ${per}` : ''}`
  if (!withCost) return `- ${r.item}: ${q}`
  const cost = r.costPer > 0 ? ` · ≈${rm2(r.costPer)}/${r.perUnitKind}` : ''
  const unitPrice = r.pricePerUnit > 0 ? ` · ${rm2(r.pricePerUnit)}/${r.unit}` : ''
  return `- ${r.item}: ${q}${unitPrice}${cost}`
}

export interface InvoiceGroup { groupKey: string; company: string; invoiceNo: string; invoiceDate: string; rows: HermesRow[] }

/** Kumpul baris ikut invois (Company + No Invois + Tarikh Invois), susunan ikut kemunculan. */
export function groupByInvoice(rows: HermesRow[]): InvoiceGroup[] {
  const map = new Map<string, InvoiceGroup>()
  for (const r of rows) {
    const k = `${r.company}|${r.invoiceNo}|${r.invoiceDate}`
    const g = map.get(k)
    if (g) g.rows.push(r)
    else map.set(k, { groupKey: createHash('sha1').update(k).digest('hex').slice(0, 12), company: r.company, invoiceNo: r.invoiceNo, invoiceDate: r.invoiceDate, rows: [r] })
  }
  return [...map.values()]
}

const MAX_LINES = 20
export function stockInMessage(g: InvoiceGroup, withCost: boolean): string {
  const head = ['*Buah baru masuk*', [g.company || 'Pembekal', g.invoiceNo, g.invoiceDate ? fmtDate(g.invoiceDate) : ''].filter(Boolean).join(' · ')]
  const lines = g.rows.slice(0, MAX_LINES).map(r => describeRow(r, withCost))
  if (g.rows.length > MAX_LINES) lines.push(`- …dan ${g.rows.length - MAX_LINES} item lagi`)
  const totalQty = g.rows.reduce((s, r) => s + r.qty, 0)
  const foot = [`${g.rows.length} item · ${totalQty % 1 ? totalQty.toFixed(1) : totalQty} ${g.rows.every(r => r.unit === g.rows[0].unit) ? g.rows[0].unit : 'unit'}`, 'Sumber: sheet Hermes']
  return [...head, ...lines, foot.join(' · ')].join('\n')
}
