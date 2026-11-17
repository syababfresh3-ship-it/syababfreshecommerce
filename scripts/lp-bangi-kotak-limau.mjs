// 17 Nov 2026 petang — Forella Pear HABIS (produk forella-pear-bangi sudah is_active=false).
// Keputusan pemilik: Kotak Buah Keluarga RM45 ganti "Forella Pear ±1.5kg" → "Limau Baby 1kg";
// poster RM45 (ada teks & gambar pear) DIBUANG sementara sehingga poster baru siap;
// kad "Forella Pear 2kg RM12" + slug dalam {{checkout}} dibuang dari LP bangi.
// TIDAK disentuh: promo_rules.prices (kunci forella kekal, produk tak aktif), POS "Promo Bangi",
// LP harumanis-surabaya-wa (slug forella di sana tersembunyi sendiri sebab produk tak aktif).
//   node scripts/lp-bangi-kotak-limau.mjs [--write]   (dry-run lalai, idempoten)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }

// Poster lama (simpan rujukan untuk pasang semula / ganti): product-images/1794482271205-kotakbuahrm45.webp
const POSTER = 'https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/product-images/1794482271205-kotakbuahrm45.webp'
const DESC = 'Kotak 5 jenis buah segar: Shine Muscat 1kg, Mata Kucing 2kg, Ubi Jepun 1kg, Sweet Persimmon 8 biji dan Limau Baby 1kg. Promo perkenalan warga Bangi.'

// 1) Produk kotak-buah-keluarga: deskripsi + buang poster (image_url null → checkout papar tanpa gambar)
const kb = await one(sb.from('products').select('id, description, image_url, images').eq('slug', 'kotak-buah-keluarga').single())
const patch = {}
if (kb.description !== DESC) patch.description = DESC
if (kb.image_url) patch.image_url = null
if (Array.isArray(kb.images) && kb.images.length) patch.images = []
log('kotak-buah-keluarga →', Object.keys(patch).length ? Object.keys(patch).join(', ') : '(tiada perubahan)')
if (WRITE && Object.keys(patch).length) await one(sb.from('products').update(patch).eq('id', kb.id))

// 2) Sahkan forella-pear-bangi memang tak aktif (kalau aktif, hentikan — pemilik perlu putuskan)
const fp = await one(sb.from('products').select('id, is_active').eq('slug', 'forella-pear-bangi').single())
if (fp.is_active) throw new Error('forella-pear-bangi masih is_active=true — nyahaktifkan dulu di Admin › Products sebelum buang kad')

// 3) LP bangi html_content
const lp = await one(sb.from('landing_pages').select('id, html_content').eq('slug', 'bangi').single())
let html = lp.html_content
const rep = (o, n) => {
  const c = html.split(o).length - 1
  if (c === 0) { log(`  (anchor dah tiada, langkau) ${o.trim().slice(0, 70)}`); return }
  if (c !== 1) throw new Error(`anchor x${c}: ${o.slice(0, 80)}`)
  html = html.replace(o, n)
}
// poster RM45 (blok penuh)
rep(`  <div class="bg-poster">\n    <img src="${POSTER}" alt="Kotak Buah Keluarga RM45 — Shine Muscat, Mata Kucing, Ubi Jepun, Sweet Persimmon, Forella Pear" width="1200" height="1200">\n  </div>\n`, '')
// senarai isi kotak
rep('<li>Forella Pear ±1.5kg</li>', '<li>Limau Baby 1kg</li>')
// kad Forella Pear 2kg dalam grid
rep(`    <div class="bg-card">\n      <img src="https://lbbhlgqimswtbupcxtda.supabase.co/storage/v1/object/public/product-images/1794390149681-btfhijbwmh.webp" alt="Forella Pear" loading="lazy">\n      <div class="b"><div class="n">Forella Pear</div><div class="u">2kg</div><div class="p"><b>RM12</b><s>RM20</s></div></div>\n    </div>\n`, '')
// slug dalam tag checkout
rep('shine-muscat-bangi,forella-pear-bangi,sunkist-hijau-bangi', 'shine-muscat-bangi,sunkist-hijau-bangi')

const left = html.split(/forella/i).length - 1
if (left) throw new Error(`masih ada ${left} sebutan Forella dalam html — semak manual`)
log(`html_content ${lp.html_content.length} → ${html.length} aksara; sebutan Forella: 0; "Limau Baby 1kg" x${html.split('Limau Baby 1kg').length - 1}`)
if (WRITE && html !== lp.html_content) {
  await one(sb.from('landing_pages').update({ html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
  log('landing_pages bangi dikemas kini')
}
log(WRITE ? 'SIAP. Poster baru: pasang semula blok .bg-poster + products.image_url bila fail diterima.' : 'Dry-run tamat.')
