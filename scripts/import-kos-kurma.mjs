// Import kos kurma/serunding/kacang/kismis/jus dari Excel "Profit Calculator TIKTOK ALL"
// tab "Kurma 2026" + "DROPSHIP RETAIL". Padan ikut SAIZ terus (100g/300g/500g/1kg/2kg/5kg) — no teka berat.
// Guna: node scripts/import-kos-kurma.mjs            (dry-run)
//       node scripts/import-kos-kurma.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

const APPLY = process.argv.includes('--apply')
const XLSX_PATH = '/Users/anas./Downloads/Profit Calculator TIKTOK ALL (1).xlsx'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Normalize saiz jadi token seragam: 100g,300g,500g,1kg,2kg,5kg
function sizeToken(s) {
  const t = String(s).toLowerCase().replace(/\s/g, '')
  if (/5kg|5000g/.test(t)) return '5kg'
  if (/2kg|2000g/.test(t)) return '2kg'
  if (/1kg|1000g/.test(t)) return '1kg'
  if (/500g|500gm|0\.5kg/.test(t)) return '500g'
  if (/800g/.test(t)) return '800g'
  if (/400g/.test(t)) return '400g'
  if (/300g/.test(t)) return '300g'
  if (/250g/.test(t)) return '250g'
  if (/200g/.test(t)) return '200g'
  if (/100g/.test(t)) return '100g'
  if (/10kg/.test(t)) return '10kg'
  if (/3kg/.test(t)) return '3kg'
  return null
}

// Baca COGS dari tab Excel → Map: nama produk (upper) → {sizeToken: cogs}
const wb = XLSX.readFile(XLSX_PATH)
const cogsMap = new Map()
for (const tab of ['Kurma 2026', 'DROPSHIP RETAIL']) {
  const ws = wb.Sheets[tab]; if (!ws) continue
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  let cogsCol = 9
  for (const r of rows) { const j = r.findIndex((c) => String(c).trim().toUpperCase() === 'COGS'); if (j >= 0) { cogsCol = j; break } }
  let prod = ''
  for (const r of rows) {
    const p = String(r[0]).replace(/\n/g, ' ').trim()
    if (p) prod = p
    const size = sizeToken(r[1])
    const cogs = Number(r[cogsCol])
    if (!size || !isFinite(cogs) || cogs <= 0) continue
    const key = prod.toUpperCase()
    if (!cogsMap.has(key)) cogsMap.set(key, {})
    if (cogsMap.get(key)[size] == null) cogsMap.get(key)[size] = cogs
  }
}

// MAP: [regex produk website, nama Excel (UPPER)]. Grade diandaikan — semak di page.
// PENTING: rule lebih spesifik (Premium Kotak) mesti DULU; setiap produk padan SATU rule sahaja.
const MAP = [
  [/premium \(kotak\).*ajwa|ajwa aliyah premium \(kotak\)/i, 'AJWA ALIYAH PREMIUM'],
  [/^ajwa aliyah/i, 'AJWA ALIYAH PREMIUM'],
  [/^ajwa medium/i, 'AJWA PREMIUM A'],
  [/^ajwa large/i, 'AJWA PREMIUM AA'],
  [/^ajwa super jumbo/i, 'AJWA SUPER JUMBO VIP'],
  [/^ajwa jumbo/i, 'AJWA JUMBO'],
  [/^mariami premium/i, 'MARIAMI AAA'],
  [/^mariami aaa/i, 'MARIAMI AAA'],
  [/^mariami aa\b/i, 'MARIAMI AA'],
  [/^mariami a\b/i, 'MARIAMI A'],
  [/^safawi jumbo premium/i, 'SAFAWI JUMBO'],
  [/^safawi jumbo/i, 'SAFAWI JUMBO'],
  [/^safawi large/i, 'SAFAWI LARGE'],
  [/^safawi medium/i, 'SAFAWI MEDIUM'],
  [/^medjoul.*super jumbo/i, 'MEDJOUL PALASTINE MIX JUMBO & SUPER JUMBO'],
  [/^medjoul.*large/i, 'MEDJOUL PALASTINE LARGE'],
  [/^medjoul.*jumbo/i, 'MEDJOUL PALASTINE JUMBO'],
  [/^rotab sukkari/i, 'ROTAB SUKKARI'],
  [/^dry sukkari/i, 'DRY SUKKARI'],
  [/^mabroom/i, 'MABROOM'],
  [/^kurma tunisia/i, 'KURMA TUNISIA (TANGKAI LOOSE)'],
  [/^kismis golden jumbo/i, 'KISMIS GOLDEN JUMBO'],
  [/^kismis golden/i, 'KISMIS GOLDEN SMALL'],
  [/^kismis black/i, 'KISMIS BLACK JUMBO'],
  [/^kismis sultana/i, 'KISMIS SULTANA'],
  [/^pistachio/i, 'PISTACHIO'],
  [/^roasted almond/i, 'ALMOND'],
  [/^roasted cashew/i, 'ROASTED CASHEW WITH SKIN'],
  [/^serunding ayam/i, 'SERUNDING AYAM'],
  [/^serunding daging/i, 'SERUNDING DAGING'],
]

const { data: products } = await supabase.from('products').select('id, name').eq('is_active', true)
const { data: variants } = await supabase.from('product_variants').select('id, product_id, name').eq('is_active', true)
const now = new Date().toISOString()

const updates = []
const skipped = []

// Loop ikut PRODUK — setiap produk cari rule pertama yang padan (elak .find silap produk)
for (const p of products) {
  const rule = MAP.find(([re]) => re.test(p.name))
  if (!rule) continue
  const excelName = rule[1]
  const sizes = cogsMap.get(excelName)
  if (!sizes) { skipped.push(`${p.name} — Excel "${excelName}" tiada COGS`); continue }
  const vs = variants.filter((v) => v.product_id === p.id)
  for (const v of vs) {
    const sz = sizeToken(v.name)
    if (!sz) { skipped.push(`${p.name} / ${v.name} — saiz tak dikenali`); continue }
    const cogs = sizes[sz]
    if (cogs == null) { skipped.push(`${p.name} / ${v.name} — saiz ${sz} tiada dlm Excel ${excelName}`); continue }
    updates.push({ p, v, cogs: Math.round(cogs * 100) / 100, excelName })
  }
}

console.log(`\n=== ${APPLY ? 'APPLY' : 'DRY-RUN'} — Kos Kurma/Serunding dari Excel ===\n`)
let curP = ''
for (const u of updates) {
  if (u.p.name !== curP) { console.log(`\n${u.p.name}  ← ${u.excelName}`); curP = u.p.name }
  console.log(`  ${u.v.name}  = RM${u.cogs}`)
}
console.log(`\n--- SKIP (${skipped.length}) ---`)
for (const s of skipped) console.log('  ' + s)
console.log(`\nJumlah update: ${updates.length}`)

if (APPLY) {
  let ok = 0, fail = 0
  for (const u of updates) {
    const { data: ex } = await supabase.from('variant_costs').select('id, source').eq('product_id', u.p.id).eq('variant_id', u.v.id).maybeSingle()
    if (ex && ex.source === 'manual') continue
    const row = { kos_buah: u.cogs, source: 'sheet', updated_at: now }
    const r = ex
      ? await supabase.from('variant_costs').update(row).eq('id', ex.id)
      : await supabase.from('variant_costs').insert({ product_id: u.p.id, variant_id: u.v.id, ...row, kos_packaging: 1.25, kos_kurier: 0, kos_lain: 0 })
    if (r.error) { fail++; console.error('  ✗ ' + u.p.name + '/' + u.v.name + ': ' + r.error.message) } else ok++
  }
  console.log(`\n✓ Ditulis: ${ok} · Gagal: ${fail}`)
} else {
  console.log('\nDry-run. Untuk tulis: node scripts/import-kos-kurma.mjs --apply')
}
