// Update kos_buah dalam variant_costs guna KOS LANDED TERKINI dari Google Sheet invois
// (Hermes - Invois Syababfresh). Jadual KOS di bawah dikemaskini dari sheet — tarikh dalam komen.
// Hanya kos_buah diubah; packaging/kurier/lain dikekalkan. source → 'sheet'.
// Guna:  node scripts/update-kos-from-sheet.mjs           (dry-run)
//        node scripts/update-kos-from-sheet.mjs --apply
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// === KOS TERKINI DARI SHEET INVOIS (per kg kecuali dinyatakan) ===
// Ceri Turki: CFR 26.67-28.88 + clearance 2.88 ≈ landed 30.60 (blend, 8 Jul)
// Nota: padanan ikut nama produk website (regex, case-insensitive).
const RULES = [
  { nama: 'Ceri Turki (landed)',    re: /cherry\s*turk|ceri\s*turk/i,      kosPerKg: 30.60 },
  { nama: 'Ceri USA 9.5R (30 Jun)', re: /cherry\s*usa|ceri\s*usa/i,        kosPerKg: 46.00 },
  { nama: 'Sweet Globe (7 Jul)',    re: /sweet\s*globe/i,                  kosPerKg: 28.00 },
  { nama: 'Shine Muscat (20 Jun)',  re: /shine\s*muscat/i,                 kosPerKg: 16.00 },
  { nama: 'Sweet Sapphire (8 Jul)', re: /sweet\s*sapphire/i,               kosPerKg: 20.00 },
  { nama: 'Sugarone (6 Jul)',       re: /sugarone/i,                       kosPerKg: 26.00 },
  { nama: 'Crimson (6 Jul)',        re: /crimson/i,                        kosPerKg: 16.11 },
  { nama: 'Adora grape (8 Jul)',    re: /adora/i,                          kosPerKg: 15.56 },
  { nama: 'Navel Orange (8 Jul)',   re: /navel\s*orange|oren\s*navel/i,    kosPerKg: 4.80 },
  { nama: 'Mandarin (8 Jul)',       re: /mandarin/i,                       kosPerKg: 5.45 },
  { nama: 'Donut Peach (8 Jul)',    re: /donut\s*peach/i,                  kosPerKg: 25.00 },
  { nama: 'Strawberry USA (8 Jul)', re: /strawberry/i,                     kosPerKg: 55.00 },
  { nama: 'Blueberry (7 Jul)',      re: /blueberry|blueberi/i,             kosPerKg: 53.33 }, // China/Spain; Peru Driscolls 61.33
  { nama: 'Aprikot segar (7 Jul)',  re: /^(?!.*kering)(?=.*(aprikot|apricot))/i, kosPerKg: 34.82 },
  { nama: 'Lychee (27 Jun)',        re: /lychee|laici/i,                   kosPerKg: 14.67 },
  { nama: 'Avocado (8 Jul)',        re: /avocado|avokado/i,                kosPerKg: 10.00 },
  { nama: 'Manggis (8 Jul)',        re: /manggis/i,                        kosPerKg: 4.00 },
  { nama: 'Rambutan (8 Jul)',       re: /rambutan/i,                       kosPerKg: 3.24 },
  { nama: 'Jambu Batu (29 Jun)',    re: /jambu\s*batu/i,                   kosPerKg: 5.59 },
  { nama: 'Kurma segar bakul (8 Jul)', re: /^kurma(?!.*(libya|sejuk|muda|tunisia))/i, kosPerKg: 8.67 },
  { nama: 'Longan (8 Jul)',         re: /longan/i,                         kosPerKg: 7.22 },
  { nama: 'Musang King (5 Jul)',    re: /musang\s*king|durian/i,           kosPerKg: 15.00 },
  { nama: 'Melon Baliuwang (8 Jul)', re: /melon/i,                         kosPerBiji: 10.00 },
  { nama: 'Delima India (6 Jul)',   re: /delima|pomegranate/i,             kosPerCtn: 47.00 }, // 10 biji/ctn @ RM4.70
  { nama: 'Gold Kiwi (8 Jul)',      re: /gold\s*kiwi/i,                    kosPerBiji: 4.09 },
]

// Berat variant: guna weight_grams kalau ada, fallback parse nama ("500g","1kg","2 kg")
function beratKg(variant) {
  if (variant.weight_grams && variant.weight_grams > 0) return variant.weight_grams / 1000
  const t = (variant.name ?? '').toLowerCase().replace(/\s/g, '')
  const kg = t.match(/(\d+(?:\.\d+)?)kg/)
  if (kg) return parseFloat(kg[1])
  const g = t.match(/(\d+(?:\.\d+)?)g(?!r)/)
  if (g) return parseFloat(g[1]) / 1000
  return null
}

function countOf(variant, unit) {
  const t = (variant.name ?? '').toLowerCase()
  const m = t.match(new RegExp(`(\\d+)\\s*${unit}`))
  return m ? parseInt(m[1], 10) : null
}

const { data: products } = await supabase.from('products').select('id, name, is_active').eq('is_active', true)
const { data: variants } = await supabase
  .from('product_variants')
  .select('id, product_id, name, weight_grams, is_active')
  .eq('is_active', true)
const { data: costs } = await supabase.from('variant_costs').select('*')

const costByKey = new Map()
for (const c of costs ?? []) costByKey.set(`${c.product_id}:${c.variant_id ?? 'null'}`, c)

const variantsByProduct = new Map()
for (const v of variants ?? []) {
  const list = variantsByProduct.get(v.product_id) ?? []
  list.push(v)
  variantsByProduct.set(v.product_id, list)
}

const updates = []
const skipped = []

for (const p of products ?? []) {
  const rule = RULES.find((r) => r.re.test(p.name))
  if (!rule) continue
  const vs = variantsByProduct.get(p.id) ?? []
  const targets = vs.length > 0 ? vs : [null] // null = product-level

  for (const v of targets) {
    let kosBaru = null
    if (rule.kosPerKg != null) {
      const kg = v ? beratKg(v) : null
      if (kg) kosBaru = rule.kosPerKg * kg
      else skipped.push({ apa: `${p.name} / ${v ? v.name : '(product)'}`, sebab: 'berat tak dapat ditentukan' })
    } else if (rule.kosPerCtn != null) {
      const n = v ? (countOf(v, 'ctn') ?? countOf(v, 'kotak')) : 1
      if (n) kosBaru = rule.kosPerCtn * n
      else skipped.push({ apa: `${p.name} / ${v ? v.name : '(product)'}`, sebab: 'bilangan ctn tak jelas' })
    } else if (rule.kosPerBiji != null) {
      const n = v ? (countOf(v, 'biji') ?? countOf(v, 'pcs') ?? countOf(v, 'pack')) : null
      if (n) kosBaru = rule.kosPerBiji * n
      else skipped.push({ apa: `${p.name} / ${v ? v.name : '(product)'}`, sebab: 'bilangan biji/pcs tak jelas' })
    }
    if (kosBaru == null) continue

    kosBaru = Math.round(kosBaru * 100) / 100
    const key = `${p.id}:${v ? v.id : 'null'}`
    const existing = costByKey.get(key)
    updates.push({
      rule: rule.nama,
      apa: `${p.name} / ${v ? v.name : '(product-level)'}`,
      product_id: p.id,
      variant_id: v ? v.id : null,
      lama: existing ? existing.kos_buah : null,
      baru: kosBaru,
      existing,
    })
  }
}

console.log(`\n=== ${APPLY ? 'APPLY' : 'DRY-RUN'} — Kos buah dari Sheet Invois → variant_costs ===\n`)
for (const u of updates) {
  const arrow = u.lama != null ? `RM${u.lama} → RM${u.baru}` : `(baru) RM${u.baru}`
  console.log(`  ${u.apa}  | ${arrow}  [${u.rule}]`)
}
if (skipped.length) {
  console.log('\n--- DILANGKAU ---')
  for (const s of skipped) console.log(`  ${s.apa}  (${s.sebab})`)
}
console.log(`\nJumlah update: ${updates.length} · Dilangkau: ${skipped.length}`)

if (APPLY) {
  const now = new Date().toISOString()
  let ok = 0, fail = 0
  for (const u of updates) {
    let error
    if (u.existing) {
      ;({ error } = await supabase
        .from('variant_costs')
        .update({ kos_buah: u.baru, source: 'sheet', updated_at: now })
        .eq('id', u.existing.id))
    } else {
      ;({ error } = await supabase.from('variant_costs').insert({
        product_id: u.product_id,
        variant_id: u.variant_id,
        kos_buah: u.baru,
        kos_packaging: 0,
        kos_kurier: 0,
        kos_lain: 0,
        source: 'sheet',
        updated_at: now,
      }))
    }
    if (error) { fail++; console.error(`  ✗ ${u.apa}: ${error.message}`) }
    else ok++
  }
  console.log(`\n✓ Ditulis: ${ok} · Gagal: ${fail}`)
} else {
  console.log('\nDry-run. Untuk tulis: node scripts/update-kos-from-sheet.mjs --apply')
}
