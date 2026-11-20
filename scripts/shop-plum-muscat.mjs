// 20 Nov 2026 — dua buah baharu: Plum Merah & Anggur Muscat Merah, masing-masing versi KEDAI ONLINE
// (nampak di storefront, boleh pos, sejuk) dan versi BANGI (*-bangi tersembunyi, harga LP, kad grid LP Bangi).
// Kos pemilik: muscat merah RM42/5kg (RM8.40/kg), plum RM30/5kg (RM6/kg). HARGA JUAL di blok PRICES di bawah —
// ubah dahulu ikut keputusan pemilik, kemudian:
//   node scripts/shop-plum-muscat.mjs            → DRY-RUN
//   node scripts/shop-plum-muscat.mjs --write    → tulis (idempoten; harga varian dikemas kini jika berubah)
//   node scripts/pos-pricelist-bangi.mjs --write → segerak POS "Promo Bangi" selepas itu
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }

// ───────── HARGA JUAL (ubah di sini) ─────────
const PRICES = {
  // Pemilik 20 Nov: pilih harga Bangi AGRESIF (kali pertama jual) — muscat RM11.90, plum RM8.90; kedai kekal.
  muscat: { shop: { '1kg': 15.9, '2kg': 29.9, '5kg': 65 }, bangi: 11.9 },
  plum:   { shop: { '1kg': 12.9, '2kg': 23.9, '5kg': 52 }, bangi: 8.9 },
}
// ─────────────────────────────────────────────

const IMG = {
  plum: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/product-images/1795189707770-plum-merah.webp',
  muscat: 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/product-images/1795189679112-anggur-muscat-merah.webp',
}
const kg = (n) => ({ '1kg': 1000, '2kg': 2000, '3kg': 3000, '5kg': 5000 })[n]
const rm = (n) => 'RM' + (Number.isInteger(n) ? n : n.toFixed(2))

const SHOP = [
  { slug: 'anggur-muscat-merah', name: 'Anggur Muscat Merah', category: 'anggur', image: IMG.muscat,
    description: 'Anggur muscat merah import — buah besar, rangup, manis dengan aroma muscat. Dihantar sejuk ke pintu rumah.',
    variants: Object.entries(PRICES.muscat.shop).map(([n, p]) => ({ name: n, price: p, weight_grams: kg(n) })) },
  { slug: 'plum-merah', name: 'Plum Merah', category: 'buah-import', image: IMG.plum,
    description: 'Plum merah import — kulit merah berkilat, isi berair, manis masam yang menyegarkan. Dihantar sejuk ke pintu rumah.',
    variants: Object.entries(PRICES.plum.shop).map(([n, p]) => ({ name: n, price: p, weight_grams: kg(n) })) },
]
const BANGI = [
  { slug: 'anggur-muscat-merah-bangi', name: 'Anggur Muscat Merah', image: IMG.muscat, normal: PRICES.muscat.shop['1kg'], lp: PRICES.muscat.bangi,
    description: `Anggur muscat merah import, rangup & manis. Harga istimewa warga Bangi ${rm(PRICES.muscat.bangi)}/kg — selagi stok ada.` },
  { slug: 'plum-merah-bangi', name: 'Plum Merah', image: IMG.plum, normal: PRICES.plum.shop['1kg'], lp: PRICES.plum.bangi,
    description: `Plum merah import, berair & manis masam. Harga istimewa warga Bangi ${rm(PRICES.plum.bangi)}/kg — selagi stok ada.` },
]

async function catId(slug) { return (await one(sb.from('categories').select('id').eq('slug', slug).single())).id }

async function upsertProduct(p, { category, shippable, storefront, stock }) {
  const existing = await one(sb.from('products').select('id').eq('slug', p.slug).maybeSingle())
  let pid = existing?.id
  if (!pid) {
    log(`+ produk ${p.slug} (${p.name}) ${storefront ? 'KEDAI' : 'BANGI'} ${rm(p.variants[0].price)}/${p.variants[0].name}`)
    if (WRITE) {
      const row = await one(sb.from('products').insert({
        category_id: await catId(category), name: p.name, slug: p.slug, description: p.description, price: p.variants[0].price, compare_price: null,
        unit: 'kg', weight_grams: p.variants[0].weight_grams, image_url: p.image, images: [p.image], is_active: true, is_featured: false, sort_order: 0,
        is_shippable: shippable, show_in_storefront: storefront, is_cold: true, affiliate_pct: 0,
      }).select('id').single())
      pid = row.id
    }
  } else log(`= produk ${p.slug} sudah wujud`)
  for (const [i, v] of p.variants.entries()) {
    const ev = pid ? await one(sb.from('product_variants').select('id, price').eq('product_id', pid).eq('name', v.name).is('deleted_at', null).maybeSingle()) : null
    if (!ev) { log(`  + varian ${v.name} ${rm(v.price)}`); if (WRITE) await one(sb.from('product_variants').insert({ product_id: pid, name: v.name, price: v.price, compare_price: null, is_active: true, sort_order: i, weight_grams: v.weight_grams, stock })) }
    else if (Number(ev.price) !== v.price) { log(`  ~ varian ${v.name} ${rm(Number(ev.price))} → ${rm(v.price)}`); if (WRITE) await one(sb.from('product_variants').update({ price: v.price }).eq('id', ev.id)) }
    else log(`  = varian ${v.name} ${rm(v.price)}`)
  }
  if (pid && WRITE) await one(sb.from('products').update({ price: p.variants[0].price }).eq('id', pid))
}

// 1) Kedai online
for (const p of SHOP) await upsertProduct(p, { category: p.category, shippable: true, storefront: true, stock: 999 })
// 2) Bangi (1kg; harga varian = harga kedai 1kg → dicoret; LP = harga Bangi)
for (const b of BANGI) await upsertProduct({ ...b, variants: [{ name: '1kg', price: b.normal, weight_grams: 1000 }] }, { category: 'bangi', shippable: false, storefront: false, stock: 0 })

// 3) LP bangi: promo_rules.prices + kad grid + checkout
const lp = await one(sb.from('landing_pages').select('id, html_content, promo_rules').eq('slug', 'bangi').single())
const prices = { ...(lp.promo_rules?.prices ?? {}) }
for (const b of BANGI) prices[`${b.slug}:1kg`] = b.lp
const changed = Object.keys(prices).filter((k) => prices[k] !== lp.promo_rules?.prices?.[k])
log('promo_rules.prices:', changed.length ? changed.map((k) => `${k}=${prices[k]}`).join(', ') : '(tiada perubahan)')

let html = lp.html_content
const card = (b) => `\n    <div class="bg-card">\n      <img src="${b.image}" alt="${b.name}" loading="lazy">\n      <div class="b"><div class="n">${b.name}</div><div class="u">1kg</div><div class="p"><b>${rm(b.lp)}</b>${b.lp < b.normal ? `<s>${rm(b.normal)}</s>` : ''}</div></div>\n    </div>`
for (const b of BANGI) {
  if (html.includes(`alt="${b.name}"`)) {
    // kad sedia ada → kemas kini harga sahaja
    html = html.replace(new RegExp(`(<div class="n">${b.name}</div><div class="u">1kg</div>)<div class="p">[^]*?</div>`), `$1<div class="p"><b>${rm(b.lp)}</b>${b.lp < b.normal ? `<s>${rm(b.normal)}</s>` : ''}</div>`)
    log(`= kad ${b.name} sudah ada (harga disegerak)`)
    continue
  }
  // selepas kad Delima Tunisia (atau Limau Baby kalau tiada)
  const anchorName = html.includes('<div class="n">Delima Tunisia</div>') ? 'Delima Tunisia' : 'Limau Baby'
  const i = html.indexOf(`<div class="n">${anchorName}</div>`)
  if (i < 0) throw new Error('anchor kad tiada')
  const close = html.indexOf('\n    </div>', i) + '\n    </div>'.length
  html = html.slice(0, close) + card(b) + html.slice(close)
  log(`+ kad ${b.name} selepas ${anchorName}`)
}
html = html.replace(/\{\{checkout:([^}]*)\}\}/, (m, inner) => {
  const list = inner.split(',').map((s) => s.trim()).filter(Boolean)
  for (const b of BANGI) if (!list.includes(b.slug)) { const at = list.indexOf('limau-baby-bangi'); list.splice(at >= 0 ? at + 1 : list.length, 0, b.slug); log(`+ checkout ${b.slug}`) }
  return `{{checkout:${list.join(',')}}}`
})
if (WRITE && (changed.length || html !== lp.html_content)) {
  await one(sb.from('landing_pages').update({ promo_rules: { ...lp.promo_rules, prices }, html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
  log('landing_pages bangi dikemas kini')
}
log(WRITE ? 'SIAP — jalankan scripts/pos-pricelist-bangi.mjs --write' : 'Dry-run tamat.')
