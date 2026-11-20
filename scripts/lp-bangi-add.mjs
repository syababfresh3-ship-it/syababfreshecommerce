// Tambah produk BANGI sahaja (tersembunyi dari kedai) ke LP Bangi + POS, dipandu fail JSON config.
//   node scripts/lp-bangi-add.mjs --config scripts/lp-bangi/limau-madu.json [--write]
// Config: { slug, name, unit, description, image_from?: slug produk kedai | image?: URL, after?: nama kad anchor,
//           checkout_after?: slug, unit_line?: teks baris bawah nama, variants: [{ name, normal, lp, weight_grams }] }
// Idempoten: produk/varian/kad/checkout/harga LP hanya ditambah jika tiada; harga dikemas kini jika berubah.
// Selepas --write: node scripts/pos-pricelist-bangi.mjs --write
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null }
const cfgPath = arg('--config'); if (!cfgPath) { console.error('guna: --config <json> [--write]'); process.exit(1) }
const C = JSON.parse(readFileSync(cfgPath, 'utf8'))
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }
const rm = (n) => 'RM' + (Number.isInteger(n) ? n : n.toFixed(2))

let image = C.image || null
if (!image && C.image_from) { const src = await one(sb.from('products').select('image_url, images').eq('slug', C.image_from).maybeSingle()); image = src?.image_url || src?.images?.[0] || null; log(`gambar pinjam ${C.image_from}:`, image ? 'ada' : 'TIADA') }
const cat = await one(sb.from('categories').select('id').eq('slug', 'bangi').single())

let pid = (await one(sb.from('products').select('id').eq('slug', C.slug).maybeSingle()))?.id
if (!pid) {
  log(`+ produk ${C.slug} (${C.name})`)
  if (WRITE) pid = (await one(sb.from('products').insert({
    category_id: cat.id, name: C.name, slug: C.slug, description: C.description, price: C.variants[0].normal, compare_price: null,
    unit: C.unit || 'kg', weight_grams: C.variants[0].weight_grams, image_url: image, images: image ? [image] : [], is_active: true, is_featured: false, sort_order: 0,
    is_shippable: false, show_in_storefront: false, is_cold: true, affiliate_pct: 0,
  }).select('id').single())).id
} else log(`= produk ${C.slug} sudah wujud`)
for (const [i, v] of C.variants.entries()) {
  const ev = pid ? await one(sb.from('product_variants').select('id, price').eq('product_id', pid).eq('name', v.name).is('deleted_at', null).maybeSingle()) : null
  if (!ev) { log(`  + varian ${v.name} normal ${rm(v.normal)} → LP ${rm(v.lp)}`); if (WRITE) await one(sb.from('product_variants').insert({ product_id: pid, name: v.name, price: v.normal, compare_price: null, is_active: true, sort_order: i, weight_grams: v.weight_grams, stock: 0 })) }
  else if (Number(ev.price) !== v.normal) { log(`  ~ varian ${v.name} ${rm(Number(ev.price))} → ${rm(v.normal)}`); if (WRITE) await one(sb.from('product_variants').update({ price: v.normal }).eq('id', ev.id)) }
  else log(`  = varian ${v.name}`)
}

const lp = await one(sb.from('landing_pages').select('id, html_content, promo_rules').eq('slug', 'bangi').single())
const prices = { ...(lp.promo_rules?.prices ?? {}) }
for (const v of C.variants) prices[`${C.slug}:${v.name}`] = v.lp
const changed = Object.keys(prices).filter((k) => prices[k] !== lp.promo_rules?.prices?.[k])
log('promo_rules.prices:', changed.length ? changed.map((k) => `${k}=${prices[k]}`).join(', ') : '(tiada perubahan)')

let html = lp.html_content
const lines = C.variants.map((v, i) => `<div class="p"${i ? ' style="margin-top:2px"' : ''}><b>${rm(v.lp)}</b>${v.lp < v.normal ? `<s>${rm(v.normal)}</s>` : ''}<span class="u">${v.name}</span></div>`).join('')
const card = `\n    <div class="bg-card">\n${image ? `      <img src="${image}" alt="${C.name}" loading="lazy">\n` : ''}      <div class="b"><div class="n">${C.name}</div>${C.unit_line ? `<div class="u">${C.unit_line}</div>` : ''}${lines}</div>\n    </div>`
if (html.includes(`<div class="n">${C.name}</div>`)) log('= kad sudah ada')
else {
  const anchor = C.after && html.includes(`<div class="n">${C.after}</div>`) ? C.after : 'Limau Baby'
  const i = html.indexOf(`<div class="n">${anchor}</div>`); if (i < 0) throw new Error('anchor kad tiada')
  const close = html.indexOf('\n    </div>', i) + '\n    </div>'.length
  html = html.slice(0, close) + card + html.slice(close)
  log(`+ kad ${C.name} selepas ${anchor}`)
}
html = html.replace(/\{\{checkout:([^}]*)\}\}/, (m, inner) => {
  const list = inner.split(',').map((s) => s.trim()).filter(Boolean)
  if (!list.includes(C.slug)) { const at = C.checkout_after ? list.indexOf(C.checkout_after) : -1; list.splice(at >= 0 ? at + 1 : list.length, 0, C.slug); log(`+ checkout ${C.slug}`) }
  return `{{checkout:${list.join(',')}}}`
})
if (WRITE && (changed.length || html !== lp.html_content)) {
  await one(sb.from('landing_pages').update({ promo_rules: { ...lp.promo_rules, prices }, html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
  log('landing_pages bangi dikemas kini')
}
log(WRITE ? 'SIAP — jalankan scripts/pos-pricelist-bangi.mjs --write' : 'Dry-run tamat.')
