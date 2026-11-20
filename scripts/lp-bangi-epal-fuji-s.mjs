// 21 Nov 2026 — pemilik: "masukkan dalam promo bangi fuji apple S, kos 0.60/pcs, buat harga agresif".
// Produk Bangi sahaja: epal-fuji-s-bangi (unit biji). Harga LP agresif (~30% margin): 5 biji RM5, 10 biji RM9, 20 biji RM17.
// Harga varian (coret) = rujukan runcit RM1.30/biji: 5 → RM6.50, 10 → RM13, 20 → RM26. Gambar pinjam produk kedai apple-fuji-xl.
//   node scripts/lp-bangi-epal-fuji-s.mjs [--write]   (dry-run lalai, idempoten) → kemudian scripts/pos-pricelist-bangi.mjs --write
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }
const rm = (n) => 'RM' + (Number.isInteger(n) ? n : n.toFixed(2))

const SLUG = 'epal-fuji-s-bangi', NAME = 'Epal Fuji S'
const VARIANTS = [
  { name: '5 biji', normal: 6.5, lp: 5, weight_grams: 600 },
  { name: '10 biji', normal: 13, lp: 9, weight_grams: 1200 },
  { name: '20 biji', normal: 26, lp: 17, weight_grams: 2400 },
]
const DESC = 'Epal Fuji saiz S import — manis, rangup, sesuai bekal sekolah. Harga istimewa warga Bangi dari RM1 sebiji — selagi stok ada.'

const src = await one(sb.from('products').select('image_url, images').eq('slug', 'apple-fuji-xl').maybeSingle())
const image = src?.image_url || src?.images?.[0] || null
log('gambar pinjam apple-fuji-xl:', image ? 'ada' : 'TIADA')
const cat = await one(sb.from('categories').select('id').eq('slug', 'bangi').single())

let pid = (await one(sb.from('products').select('id').eq('slug', SLUG).maybeSingle()))?.id
if (!pid) {
  log(`+ produk ${SLUG} (${NAME})`)
  if (WRITE) pid = (await one(sb.from('products').insert({
    category_id: cat.id, name: NAME, slug: SLUG, description: DESC, price: VARIANTS[0].normal, compare_price: null,
    unit: 'biji', weight_grams: VARIANTS[0].weight_grams, image_url: image, images: image ? [image] : [], is_active: true, is_featured: false, sort_order: 0,
    is_shippable: false, show_in_storefront: false, is_cold: true, affiliate_pct: 0,
  }).select('id').single())).id
} else log(`= produk ${SLUG} sudah wujud`)
for (const [i, v] of VARIANTS.entries()) {
  const ev = pid ? await one(sb.from('product_variants').select('id, price').eq('product_id', pid).eq('name', v.name).is('deleted_at', null).maybeSingle()) : null
  if (!ev) { log(`  + varian ${v.name} normal ${rm(v.normal)} → LP ${rm(v.lp)}`); if (WRITE) await one(sb.from('product_variants').insert({ product_id: pid, name: v.name, price: v.normal, compare_price: null, is_active: true, sort_order: i, weight_grams: v.weight_grams, stock: 0 })) }
  else if (Number(ev.price) !== v.normal) { log(`  ~ varian ${v.name} ${rm(Number(ev.price))} → ${rm(v.normal)}`); if (WRITE) await one(sb.from('product_variants').update({ price: v.normal }).eq('id', ev.id)) }
  else log(`  = varian ${v.name}`)
}

const lp = await one(sb.from('landing_pages').select('id, html_content, promo_rules').eq('slug', 'bangi').single())
const prices = { ...(lp.promo_rules?.prices ?? {}) }
for (const v of VARIANTS) prices[`${SLUG}:${v.name}`] = v.lp
const changed = Object.keys(prices).filter((k) => prices[k] !== lp.promo_rules?.prices?.[k])
log('promo_rules.prices:', changed.length ? changed.map((k) => `${k}=${prices[k]}`).join(', ') : '(tiada perubahan)')

let html = lp.html_content
const lines = VARIANTS.map((v, i) => `<div class="p"${i ? ' style="margin-top:2px"' : ''}><b>${rm(v.lp)}</b><s>${rm(v.normal)}</s><span class="u">${v.name}</span></div>`).join('')
const card = `\n    <div class="bg-card">\n${image ? `      <img src="${image}" alt="${NAME}" loading="lazy">\n` : ''}      <div class="b"><div class="n">${NAME}</div><div class="u">Dari RM1 sebiji</div>${lines}</div>\n    </div>`
if (html.includes(`<div class="n">${NAME}</div>`)) log('= kad sudah ada')
else {
  const anchor = html.includes('<div class="n">Plum Merah</div>') ? 'Plum Merah' : 'Limau Baby'
  const i = html.indexOf(`<div class="n">${anchor}</div>`); if (i < 0) throw new Error('anchor tiada')
  const close = html.indexOf('\n    </div>', i) + '\n    </div>'.length
  html = html.slice(0, close) + card + html.slice(close)
  log(`+ kad ${NAME} selepas ${anchor}`)
}
html = html.replace(/\{\{checkout:([^}]*)\}\}/, (m, inner) => {
  const list = inner.split(',').map((s) => s.trim()).filter(Boolean)
  if (!list.includes(SLUG)) { const at = list.indexOf('plum-merah-bangi'); list.splice(at >= 0 ? at + 1 : list.length, 0, SLUG); log(`+ checkout ${SLUG}`) }
  return `{{checkout:${list.join(',')}}}`
})
if (WRITE && (changed.length || html !== lp.html_content)) {
  await one(sb.from('landing_pages').update({ promo_rules: { ...lp.promo_rules, prices }, html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
  log('landing_pages bangi dikemas kini')
}
log(WRITE ? 'SIAP — jalankan scripts/pos-pricelist-bangi.mjs --write' : 'Dry-run tamat.')
