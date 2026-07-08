// Import kos dari katalog pricing TikTok (syababfresh-app products.json) → variant_costs.
// Mapping: kos_buah←cogsDirect, kos_packaging←kotak+bekas+sticker+freegift,
//          kos_kurier←shippingSeller, kos_lain←wastageRM+overhead. marketing TIDAK diimport.
// Guna:  node scripts/import-kos-tiktok.mjs           (dry-run — papar padanan sahaja)
//        node scripts/import-kos-tiktok.mjs --apply   (tulis ke Supabase)
// Nota:  baris source='manual' TIDAK ditindih.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const CATALOG_PATH = '/Users/anas./syababfresh-app/app/pricing/products.json'

// Baca env dari .env.local (script standalone, tanpa next)
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))

// Normalize nama untuk padanan: lowercase, buang simbol/gelaran biasa
function norm(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\[.*?\]/g, ' ')
    .replace(/[^a-z0-9+.]/g, ' ')
    .replace(/\b(fresh|segar|import|premium|baru|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Normalize saiz: "1kg", "1 kg", "1000g" → token seragam
function normSize(s) {
  const t = norm(s).replace(/\s/g, '')
  const g = t.match(/^(\d+(?:\.\d+)?)g$/)
  if (g) return `${parseFloat(g[1]) / 1000}kg`
  const kg = t.match(/^(\d+(?:\.\d+)?)kg$/)
  if (kg) return `${parseFloat(kg[1])}kg`
  return t
}

// Skor padanan nama: berapa banyak token catalog base ada dalam nama produk website
function nameScore(catalogBase, productName) {
  const a = norm(catalogBase).split(' ').filter(Boolean)
  const b = new Set(norm(productName).split(' ').filter(Boolean))
  if (a.length === 0) return 0
  let hit = 0
  for (const t of a) if (b.has(t)) hit++
  return hit / a.length
}

const { data: products, error: pErr } = await supabase
  .from('products')
  .select('id, name, is_active')
  .eq('is_active', true)
if (pErr) { console.error('Gagal baca products:', pErr.message); process.exit(1) }

const { data: variants, error: vErr } = await supabase
  .from('product_variants')
  .select('id, product_id, name, is_active')
  .eq('is_active', true)
if (vErr) { console.error('Gagal baca variants:', vErr.message); process.exit(1) }

const { data: existingCosts } = await supabase.from('variant_costs').select('product_id, variant_id, source')
const manualKeys = new Set(
  (existingCosts ?? [])
    .filter((c) => c.source === 'manual')
    .map((c) => `${c.product_id}:${c.variant_id ?? 'null'}`),
)

const variantsByProduct = new Map()
for (const v of variants) {
  const list = variantsByProduct.get(v.product_id) ?? []
  list.push(v)
  variantsByProduct.set(v.product_id, list)
}

const matches = []
const unmatched = []

for (const sku of catalog) {
  const kos = {
    kos_buah: Number(sku.cogsDirect) || 0,
    kos_packaging:
      (Number(sku.kotakCost) || 0) + (Number(sku.bekasCost) || 0) + (Number(sku.stickerCost) || 0) + (Number(sku.freegiftCost) || 0),
    kos_kurier: Number(sku.shippingSeller) || 0,
    kos_lain: (Number(sku.wastageRM) || 0) + (Number(sku.overhead) || 0),
  }
  if (kos.kos_buah <= 0) continue // SKU tanpa kos buah tak berguna

  // Cari produk website paling padan
  let best = null
  let bestScore = 0
  for (const p of products) {
    const score = nameScore(sku.base || sku.name, p.name)
    if (score > bestScore) { bestScore = score; best = p }
  }
  if (!best || bestScore < 0.6) {
    unmatched.push({ sku: sku.name, sebab: `tiada produk padan (skor ${bestScore.toFixed(2)})` })
    continue
  }

  // Padankan saiz dengan variant — mesti TEPAT (elak "0.5kg" termatch "5kg")
  const vs = variantsByProduct.get(best.id) ?? []
  const skuSize = normSize(sku.size || '')
  let variant = null
  if (vs.length > 0) {
    if (!skuSize) {
      unmatched.push({ sku: sku.name, sebab: `produk "${best.name}" ada variant tapi SKU tiada saiz` })
      continue
    }
    variant = vs.find((v) => normSize(v.name) === skuSize) ?? null
    if (!variant) {
      unmatched.push({ sku: sku.name, sebab: `produk "${best.name}" padan tapi saiz "${sku.size}" tak jumpa variant` })
      continue
    }
  } else if (skuSize) {
    // Produk TANPA variant: saiz SKU mesti tersebut dalam nama produk, kalau tak — jangan teka
    const pNorm = norm(best.name).replace(/\s/g, '')
    if (!pNorm.includes(skuSize.replace(/\s/g, ''))) {
      unmatched.push({ sku: sku.name, sebab: `produk "${best.name}" (tiada variant) — saiz "${sku.size}" tak dapat disahkan` })
      continue
    }
  }

  const key = `${best.id}:${variant ? variant.id : 'null'}`
  if (manualKeys.has(key)) {
    unmatched.push({ sku: sku.name, sebab: `dilangkau — kos manual dah wujud (${best.name})` })
    continue
  }

  matches.push({
    sku: sku.name,
    produk: best.name,
    variant: variant ? variant.name : '(product-level)',
    product_id: best.id,
    variant_id: variant ? variant.id : null,
    ...kos,
  })
}

// Dedupe: kalau 2 SKU match variant sama, ambil yang terakhir (catalog terkini di atas? kekal first)
const seen = new Set()
const finalMatches = []
for (const m of matches) {
  const key = `${m.product_id}:${m.variant_id ?? 'null'}`
  if (seen.has(key)) continue
  seen.add(key)
  finalMatches.push(m)
}

console.log(`\n=== ${APPLY ? 'APPLY' : 'DRY-RUN'} — Import Kos TikTok → variant_costs ===`)
console.log(`Katalog SKU: ${catalog.length} · Padan: ${finalMatches.length} · Tak padan/langkau: ${unmatched.length}\n`)

console.log('--- PADANAN ---')
for (const m of finalMatches) {
  console.log(
    `  ${m.sku}  →  ${m.produk} / ${m.variant}  | buah RM${m.kos_buah} + pack RM${m.kos_packaging.toFixed(2)} + kurier RM${m.kos_kurier} + lain RM${m.kos_lain}`,
  )
}

console.log('\n--- TAK PADAN / DILANGKAU ---')
for (const u of unmatched) console.log(`  ${u.sku}  (${u.sebab})`)

if (APPLY) {
  let ok = 0, fail = 0
  const now = new Date().toISOString()
  for (const m of finalMatches) {
    let query = supabase.from('variant_costs').select('id, source').eq('product_id', m.product_id)
    query = m.variant_id ? query.eq('variant_id', m.variant_id) : query.is('variant_id', null)
    const { data: existing } = await query.maybeSingle()

    const row = {
      kos_buah: m.kos_buah, kos_packaging: Math.round(m.kos_packaging * 100) / 100,
      kos_kurier: m.kos_kurier, kos_lain: m.kos_lain,
      source: 'tiktok-catalog', updated_at: now,
    }
    let error
    if (existing) {
      if (existing.source === 'manual') continue // jaga-jaga berganda
      ;({ error } = await supabase.from('variant_costs').update(row).eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('variant_costs').insert({ product_id: m.product_id, variant_id: m.variant_id, ...row }))
    }
    if (error) { fail++; console.error(`  ✗ ${m.produk}/${m.variant}: ${error.message}`) }
    else ok++
  }
  console.log(`\n✓ Ditulis: ${ok} baris · Gagal: ${fail}`)
} else {
  console.log('\nDry-run sahaja. Untuk tulis: node scripts/import-kos-tiktok.mjs --apply')
}
