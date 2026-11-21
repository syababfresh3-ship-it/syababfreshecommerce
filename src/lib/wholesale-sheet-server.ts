// Server: tarik tab "Harga Wholesale 2027" (sheet MASTER HARGA KURMA 2027; CSV export awam, corak sama
// gift-cost-sheet-server.ts) → simpan app_settings.wholesale_sheet. Env WHOLESALE_SHEET_CSV_URL untuk ganti sumber.
import { WHOLESALE_SHEET_KEY, WHOLESALE_PROMO_SHEET_KEY, parseWholesaleSheetCsv, type WholesaleSheet } from '@/lib/wholesale-sheet'

const SHEET_ID = '1eSIohPzOB3SDYk7JPa5O37WvqkI7hWREUBEPi_JpA9A'
const GID = '370660936'   // tab "Harga Wholesale 2027"
export const WHOLESALE_PROMO_GID = '5272027'   // tab "Harga Promo 2027" (promo direct/WA, sementara)
export const WHOLESALE_SHEET_CSV_URL = process.env.WHOLESALE_SHEET_CSV_URL || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`
export const WHOLESALE_PROMO_CSV_URL = process.env.WHOLESALE_PROMO_CSV_URL || `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${WHOLESALE_PROMO_GID}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow', cache: 'no-store' })
  if (!res.ok) throw new Error(`Google Sheet balas HTTP ${res.status}`)
  const ct = res.headers.get('content-type') ?? ''
  const text = await res.text()
  if (!/csv|text\/plain/.test(ct) || /<html/i.test(text.slice(0, 200))) throw new Error('Sheet memulangkan halaman log masuk, bukan CSV — kongsi sheet sebagai "sesiapa dengan pautan"')
  return text
}

export async function fetchWholesaleSheet(): Promise<WholesaleSheet> {
  return parseWholesaleSheetCsv(await fetchCsv(WHOLESALE_SHEET_CSV_URL), { version: '2027', source_gid: GID })
}

/** Tab Promo: senario 'A' = tanpa marketing (lalai — "untuk tempoh / pelanggan terpilih"), 'B' = dengan marketing. */
export async function fetchWholesalePromoSheet(scenario: 'A' | 'B' = 'A', until: string | null = null): Promise<WholesaleSheet> {
  const sheet = parseWholesaleSheetCsv(await fetchCsv(WHOLESALE_PROMO_CSV_URL), { version: '2027', source_gid: WHOLESALE_PROMO_GID, section: scenario === 'B' ? /^senario\s+b/i : undefined })
  return { ...sheet, scenario, promo_until: until }
}

export async function loadWholesalePromoSheet(sb: SB): Promise<WholesaleSheet | null> {
  const { data } = await sb.from('app_settings').select('value').eq('key', WHOLESALE_PROMO_SHEET_KEY).maybeSingle()
  if (!data?.value) return null
  try { return JSON.parse(data.value) as WholesaleSheet } catch { return null }
}

export async function saveWholesalePromoSheet(sb: SB, sheet: WholesaleSheet | null): Promise<void> {
  const { error } = sheet
    ? await sb.from('app_settings').upsert({ key: WHOLESALE_PROMO_SHEET_KEY, value: JSON.stringify(sheet) }, { onConflict: 'key' })
    : await sb.from('app_settings').delete().eq('key', WHOLESALE_PROMO_SHEET_KEY)
  if (error) throw new Error(error.message)
}

/** Sheet yang berkuat kuasa untuk sebut harga/item picker: promo (jika ada & belum tamat, ikut tarikh KL) > wholesale. */
export async function loadEffectiveWholesaleSheet(sb: SB, today = todayKL()): Promise<WholesaleSheet | null> {
  const promo = await loadWholesalePromoSheet(sb)
  if (promo?.promo_until && today <= promo.promo_until) return promo
  return loadWholesaleSheet(sb)
}

export const todayKL = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })

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
