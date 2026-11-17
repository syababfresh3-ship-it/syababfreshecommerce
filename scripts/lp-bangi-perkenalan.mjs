// LP /lp/bangi — harga perkenalan (jadual pemilik 17 Nov 2026, 7 buah).
// Tambah 5 produk baharu kategori `bangi` (tersembunyi dari kedai), laras 2 sedia ada,
// kemas kini promo_rules.prices (harga LP) & html_content (kad + tag {{checkout}}).
//
//   node scripts/lp-bangi-perkenalan.mjs           → DRY-RUN (tunjuk apa akan berubah)
//   node scripts/lp-bangi-perkenalan.mjs --write    → tulis sebenar (idempotent; selamat ulang)
//
// Corak harga LP bangi: harga varian = harga NORMAL (dicoret), promo_rules.prices["slug:varian"] = harga LP.
// Harga kedai utama tidak disentuh (produk *-bangi show_in_storefront=false).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)

// ── Data (jadual pemilik) ─────────────────────────────────────────────
// Normal = harga varian (dicoret). lp = harga LP (promo). Pancingan = Red Fingers 1kg RM9.90, Delima 3 biji RM10. Pembetulan 17 Nov petang: lihat lp-bangi-perkenalan-2.mjs.
const NEW_PRODUCTS = [
  { slug: 'delima-bangi', name: 'Delima', unit: 'biji', weight_grams: 300, price: 4.5, image_from: 'delima-tunisia',
    description: 'Delima import, berair & manis. Harga perkenalan warga Bangi — 3 biji RM10 (harga pancingan), 2 biji RM7.50, sebiji RM4.50.',
    variants: [{ name: '1 biji', price: 4.5, weight_grams: 300 }, { name: '2 biji', price: 9, weight_grams: 600 }, { name: '3 biji', price: 13.5, weight_grams: 900 }],
    lp: { '2 biji': 7.5, '3 biji': 10 } },
  { slug: 'anggur-jari-hitam-bangi', name: 'Anggur Jari Hitam', unit: 'kg', weight_grams: 1000, price: 21.9, image_from: 'anggur-autumn-royal',
    description: 'Anggur jari hitam (black finger) tanpa biji, rangup & manis. Harga perkenalan warga Bangi RM18.90/kg.',
    variants: [{ name: '1kg', price: 21.9, weight_grams: 1000 }], lp: { '1kg': 18.9 } },
  { slug: 'anggur-red-fingers-bangi', name: 'Anggur Red Fingers', unit: 'kg', weight_grams: 1000, price: 13.9, image_from: 'anggur-merah-panjang',
    description: 'Anggur Red Fingers (anggur merah panjang) tanpa biji, rangup & manis. Harga pancingan warga Bangi RM9.90/kg — selagi stok ada.',
    variants: [{ name: '1kg', price: 13.9, weight_grams: 1000 }], lp: { '1kg': 9.9 } },
  { slug: 'strawberry-apple-bangi', name: 'Strawberry Apple', unit: 'kg', weight_grams: 1000, price: 9.9, image_from: null,
    description: 'Epal strawberry import, rangup & manis. Harga perkenalan warga Bangi RM8.90/kg.',
    variants: [{ name: '1kg', price: 9.9, weight_grams: 1000 }], lp: { '1kg': 8.9 } },
  { slug: 'limau-baby-bangi', name: 'Limau Baby', unit: 'kg', weight_grams: 1000, price: 9.9, image_from: null,
    description: 'Limau baby import, manis & mudah dikupas. Harga perkenalan warga Bangi RM8.50/kg.',
    variants: [{ name: '1kg', price: 9.9, weight_grams: 1000 }], lp: { '1kg': 8.5 } },
]
const ADJUST = [
  // Pisang kaki: normal RM1.50/biji → 4/8/12 pcs RM6/12/18 (dicoret); pemilik 17 Nov: promo RM1 sebiji → LP RM4/8/12.
  { slug: 'sweet-persimmon-bangi', price: 6, variants: { '4 pcs': 6, '8 pcs': 12, '12 pcs': 18 }, lp: { '4 pcs': 4, '8 pcs': 8, '12 pcs': 12 } },
  // Anggur Muscat = Shine Muscat: pemilik kekalkan RM12/kg (tiada coretan).
  { slug: 'shine-muscat-bangi', price: 12, variants: { '1kg': 12 }, lp: { '1kg': 12 } },
]
const NEW_CHECKOUT_SLUGS = ['delima-bangi', 'anggur-jari-hitam-bangi', 'anggur-red-fingers-bangi', 'strawberry-apple-bangi', 'limau-baby-bangi']

// ── Helpers ───────────────────────────────────────────────────────────
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }
const card = ({ img, alt, name, unit, price, strike, hint, extra }) => `    <div class="bg-card">
${img ? `      <img src="${img}" alt="${alt ?? name}" loading="lazy">\n` : ''}      <div class="b"><div class="n">${name}</div><div class="u">${unit}</div><div class="p"><b>${price}</b>${strike ? `<s>${strike}</s>` : ''}</div>${extra ?? ''}${hint ? `<div class="hint">${hint}</div>` : ''}</div>
    </div>`

async function main() {
  const cat = await one(sb.from('categories').select('id').eq('slug', 'bangi').single())
  log('kategori bangi:', cat.id)

  // 1) Produk baharu + varian
  for (const np of NEW_PRODUCTS) {
    let image_url = null
    if (np.image_from) {
      const src = await one(sb.from('products').select('image_url, images').eq('slug', np.image_from).maybeSingle())
      image_url = src?.image_url || src?.images?.[0] || null
    }
    np._image_url = image_url
    const existing = await one(sb.from('products').select('id').eq('slug', np.slug).maybeSingle())
    let pid = existing?.id
    if (!pid) {
      log(`+ produk ${np.slug} (${np.name}) RM${np.price}/${np.unit} img=${image_url ? 'guna semula ' + np.image_from : 'TIADA'}`)
      if (WRITE) {
        const row = await one(sb.from('products').insert({
          category_id: cat.id, name: np.name, slug: np.slug, description: np.description, price: np.price, compare_price: null,
          unit: np.unit, weight_grams: np.weight_grams, image_url, images: [], is_active: true, is_featured: false, sort_order: 0,
          is_shippable: false, show_in_storefront: false, is_cold: true, affiliate_pct: 0,
        }).select('id').single())
        pid = row.id
      }
    } else log(`= produk ${np.slug} sudah wujud (${pid})`)
    for (const [i, v] of np.variants.entries()) {
      const ev = pid ? await one(sb.from('product_variants').select('id, price').eq('product_id', pid).eq('name', v.name).is('deleted_at', null).maybeSingle()) : null
      if (!ev) {
        log(`  + varian ${v.name} RM${v.price} (LP ${np.lp[v.name] ?? '—'})`)
        if (WRITE) await one(sb.from('product_variants').insert({ product_id: pid, name: v.name, price: v.price, compare_price: null, is_active: true, sort_order: i, weight_grams: v.weight_grams, stock: 0 }))
      } else if (Number(ev.price) !== v.price) {
        log(`  ~ varian ${v.name} RM${ev.price} → RM${v.price}`)
        if (WRITE) await one(sb.from('product_variants').update({ price: v.price }).eq('id', ev.id))
      } else log(`  = varian ${v.name} RM${v.price}`)
    }
  }

  // 2) Laras produk sedia ada
  for (const a of ADJUST) {
    const p = await one(sb.from('products').select('id, price, product_variants(id, name, price, deleted_at)').eq('slug', a.slug).single())
    if (Number(p.price) !== a.price) { log(`~ ${a.slug} harga asas RM${p.price} → RM${a.price}`); if (WRITE) await one(sb.from('products').update({ price: a.price }).eq('id', p.id)) }
    for (const [name, price] of Object.entries(a.variants)) {
      const v = p.product_variants.find(x => x.name === name && !x.deleted_at)
      if (!v) { log(`  ! varian ${name} tiada pada ${a.slug} — langkau`); continue }
      if (Number(v.price) !== price) { log(`  ~ ${a.slug}:${name} normal RM${v.price} → RM${price} (LP ${a.lp[name]})`); if (WRITE) await one(sb.from('product_variants').update({ price }).eq('id', v.id)) }
      else log(`  = ${a.slug}:${name} normal RM${price} (LP ${a.lp[name]})`)
    }
  }

  // 3) landing_pages bangi: promo_rules.prices + html_content
  const lp = await one(sb.from('landing_pages').select('id, promo_rules, html_content').eq('slug', 'bangi').single())
  const prices = { ...(lp.promo_rules?.prices ?? {}) }
  for (const np of NEW_PRODUCTS) for (const [vn, v] of Object.entries(np.lp)) prices[`${np.slug}:${vn}`] = v
  for (const a of ADJUST) for (const [vn, v] of Object.entries(a.lp)) prices[`${a.slug}:${vn}`] = v
  const changed = Object.entries(prices).filter(([k, v]) => lp.promo_rules?.prices?.[k] !== v)
  log('promo_rules.prices berubah:', changed.map(([k, v]) => `${k}=${v}`).join(', ') || '(tiada)')

  let html = lp.html_content
  if (html.includes('anggur-red-fingers-bangi') || html.includes('anggur-rai-or-bangi')) {
    log('html_content sudah dikemas kini — langkau')
  } else {
    const img = Object.fromEntries(NEW_PRODUCTS.map(n => [n.slug, n._image_url]))
    const rep = (oldS, newS) => { const n = html.split(oldS).length - 1; if (n !== 1) throw new Error(`anchor x${n}: ${oldS.slice(0, 80)}`); html = html.replace(oldS, newS) }
    // Kuota terhad: 2 harga pancingan baharu di depan, 2 sedia ada kekal
    rep('<p class="sub">Dua tawaran paling rendah minggu ini — selagi stok ada.</p>\n  <div class="bg-grid">',
      '<p class="sub">Harga pancingan minggu ini — selagi stok ada.</p>\n  <div class="bg-grid">\n' +
      card({ img: img['anggur-red-fingers-bangi'], name: 'Anggur Red Fingers', unit: '1kg · harga pancingan', price: 'RM9.90', strike: 'RM13.90' }) + '\n' +
      card({ img: img['delima-bangi'], name: 'Delima', unit: '3 biji · harga pancingan', price: 'RM10', strike: 'RM13.50', hint: 'Pilih varian “3 biji” di borang.' }))
    // Persimmon 12 biji: coret ikut normal baharu RM1.50 sebiji
    rep('<div class="p"><b>RM12</b><s>RM26</s></div>', '<div class="p"><b>RM12</b><s>RM18</s></div>')
    // Shine Muscat: RM13.90 (coret RM15.90)
    rep('<div class="n">Shine Muscat</div><div class="u">1kg</div><div class="p"><b>RM12</b></div>',
      '<div class="n">Shine Muscat</div><div class="u">1kg</div><div class="p"><b>RM12</b></div>')
    // Persimmon pek kecil: 4 biji RM5 (coret RM6), 8 biji RM8 (coret RM12)
    rep('<div class="p"><b>RM4</b><s>RM11</s><span class="u">4 biji</span></div><div class="p" style="margin-top:2px"><b>RM8</b><s>RM19</s><span class="u">8 biji</span></div>',
      '<div class="p"><b>RM4</b><s>RM6</s><span class="u">4 biji</span></div><div class="p" style="margin-top:2px"><b>RM8</b><s>RM12</s><span class="u">8 biji</span></div>')
    // Grid "Harga perkenalan lain": 4 kad baharu di hujung
    rep('\n  </div>\n</div>\n\n<div class="bg-sec">\n  <h2>Potong siap, terus makan</h2>',
      '\n' + card({ img: img['anggur-jari-hitam-bangi'], name: 'Anggur Jari Hitam', unit: '1kg', price: 'RM18.90', strike: 'RM21.90' }) + '\n' +
      card({ img: img['delima-bangi'], name: 'Delima', unit: '2 biji', price: 'RM7.50', strike: 'RM9', extra: '<div class="p" style="margin-top:2px"><b>RM4.50</b><span class="u">1 biji</span></div>' }) + '\n' +
      card({ img: img['strawberry-apple-bangi'], name: 'Strawberry Apple', unit: '1kg', price: 'RM8.90', strike: 'RM9.90' }) + '\n' +
      card({ img: img['limau-baby-bangi'], name: 'Limau Baby', unit: '1kg', price: 'RM8.50', strike: 'RM9.90' }) +
      '\n  </div>\n</div>\n\n<div class="bg-sec">\n  <h2>Potong siap, terus makan</h2>')
    // Tag checkout: slug baharu selepas persimmon
    rep('{{checkout:kotak-buah-keluarga,mata-kucing-bangi,sweet-persimmon-bangi,',
      `{{checkout:kotak-buah-keluarga,mata-kucing-bangi,sweet-persimmon-bangi,${NEW_CHECKOUT_SLUGS.join(',')},`)
    log(`html_content: ${lp.html_content.length} → ${html.length} aksara (6 suntingan)`)
  }
  if (WRITE && (changed.length || html !== lp.html_content)) {
    await one(sb.from('landing_pages').update({ promo_rules: { ...lp.promo_rules, prices }, html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
    log('landing_pages bangi dikemas kini')
  }
  log(WRITE ? 'SIAP. LP cache 60s — semak /lp/bangi selepas seminit.' : 'Dry-run tamat. Jalankan dengan --write untuk tulis.')
}
main().catch(e => { console.error('GAGAL:', e.message); process.exit(1) })
