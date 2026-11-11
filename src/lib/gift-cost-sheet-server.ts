// Server: tarik tab "Harga Giftbox 2027" (sheet MASTER HARGA KURMA 2027; CSV export awam, corak sama lib/pricing/sheet-sync.ts) →
// simpan app_settings.gift_cost_sheet. Env GIFT_COST_SHEET_CSV_URL untuk ganti sumber.
import { GIFT_COST_SHEET_KEY, parseGiftCostSheetCsv, type GiftCostSheet } from '@/lib/gift-cost-sheet'

const SHEET_ID = '1eSIohPzOB3SDYk7JPa5O37WvqkI7hWREUBEPi_JpA9A'
const GID = '7112027'   // tab "Harga Giftbox 2027"
export const GIFT_COST_SHEET_CSV_URL = process.env.GIFT_COST_SHEET_CSV_URL || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

export async function fetchGiftCostSheet(): Promise<GiftCostSheet> {
  const res = await fetch(GIFT_COST_SHEET_CSV_URL, { redirect: 'follow', cache: 'no-store' })
  if (!res.ok) throw new Error(`Sheet tidak dapat dibaca (${res.status}) — pastikan Google Sheet dikongsi "sesiapa dengan pautan boleh lihat"`)
  const ct = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (!/csv|text\/plain/.test(ct) || /<html/i.test(text.slice(0, 200))) throw new Error('Sheet memulangkan halaman log masuk, bukan CSV — kongsi sheet sebagai "sesiapa dengan pautan"')
  return parseGiftCostSheetCsv(text, { version: '2027', source_gid: GID })
}
export async function loadGiftCostSheet(sb: SB): Promise<GiftCostSheet | null> {
  const { data } = await sb.from('app_settings').select('value').eq('key', GIFT_COST_SHEET_KEY).maybeSingle()
  if (!data?.value) return null
  try { const v = typeof data.value === 'string' ? JSON.parse(data.value) : data.value; return Array.isArray(v?.rows) ? v as GiftCostSheet : null } catch { return null }
}
export async function saveGiftCostSheet(sb: SB, sheet: GiftCostSheet): Promise<void> {
  const { error } = await sb.from('app_settings').upsert({ key: GIFT_COST_SHEET_KEY, value: JSON.stringify(sheet) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}
/** Ringkasan perbezaan dua versi sheet (untuk toast/laporan selepas tarik). */
export function diffGiftCostSheet(prev: GiftCostSheet | null, next: GiftCostSheet) {
  if (!prev) return { added: next.rows.length, changed: 0, removed: 0 }
  // Kategori dalam kunci: Ready-made qty 50/100 ≠ Custom kecil qty 50/100 untuk kurma+berat sama
  const key = (r: { category?: string; kurma: string; weight: string; qty: number }) => `${r.category ?? ''}|${r.kurma}|${r.weight}|${r.qty}`
  const pm = new Map(prev.rows.map(r => [key(r), r]))
  let added = 0, changed = 0
  for (const r of next.rows) { const p = pm.get(key(r)); if (!p) added++; else if (p.price !== r.price || p.total_cost !== r.total_cost) changed++; pm.delete(key(r)) }
  return { added, changed, removed: pm.size }
}
