// Server: tarik tab "Harga Wholesale 2027" (sheet MASTER HARGA KURMA 2027; CSV export awam, corak sama
// gift-cost-sheet-server.ts) → simpan app_settings.wholesale_sheet. Env WHOLESALE_SHEET_CSV_URL untuk ganti sumber.
import { WHOLESALE_SHEET_KEY, parseWholesaleSheetCsv, type WholesaleSheet } from '@/lib/wholesale-sheet'

const SHEET_ID = '1eSIohPzOB3SDYk7JPa5O37WvqkI7hWREUBEPi_JpA9A'
const GID = '370660936'   // tab "Harga Wholesale 2027"
export const WHOLESALE_SHEET_CSV_URL = process.env.WHOLESALE_SHEET_CSV_URL || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

export async function fetchWholesaleSheet(): Promise<WholesaleSheet> {
  const res = await fetch(WHOLESALE_SHEET_CSV_URL, { redirect: 'follow', cache: 'no-store' })
  if (!res.ok) throw new Error(`Google Sheet balas HTTP ${res.status}`)
  const ct = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (!/csv|text\/plain/.test(ct) || /<html/i.test(text.slice(0, 200))) throw new Error('Sheet memulangkan halaman log masuk, bukan CSV — kongsi sheet sebagai "sesiapa dengan pautan"')
  return parseWholesaleSheetCsv(text, { version: '2027', source_gid: GID })
}

export async function loadWholesaleSheet(sb: SB): Promise<WholesaleSheet | null> {
  const { data } = await sb.from('app_settings').select('value').eq('key', WHOLESALE_SHEET_KEY).maybeSingle()
  if (!data?.value) return null
  try { return JSON.parse(data.value) as WholesaleSheet } catch { return null }
}

export async function saveWholesaleSheet(sb: SB, sheet: WholesaleSheet): Promise<void> {
  const { error } = await sb.from('app_settings').upsert({ key: WHOLESALE_SHEET_KEY, value: JSON.stringify(sheet) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

/** Ringkasan perbezaan dua versi sheet (untuk toast selepas tarik). Kunci = jenis|gred|kg; berubah = mana-mana harga tier / kos asas. */
export function diffWholesaleSheet(prev: WholesaleSheet | null, next: WholesaleSheet) {
  if (!prev) return { added: next.rows.length, changed: 0, removed: 0 }
  const key = (r: { jenis: string; gred: string; ctn_kg: number }) => `${r.jenis}|${r.gred}|${r.ctn_kg}`
  const sig = (r: { tiers: { price: number }[]; cost_base: number }) => `${r.tiers.map(t => t.price).join(',')}|${r.cost_base}`
  const pm = new Map(prev.rows.map(r => [key(r), r]))
  let added = 0, changed = 0
  for (const r of next.rows) { const p = pm.get(key(r)); if (!p) added++; else if (sig(p) !== sig(r)) changed++; pm.delete(key(r)) }
  return { added, changed, removed: pm.size }
}
