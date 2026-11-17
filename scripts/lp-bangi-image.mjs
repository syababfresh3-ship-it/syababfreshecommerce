// Pasang gambar sebenar pada produk LP Bangi: resize/crop → WebP → Supabase Storage product-images
// → products.image_url + images → tambah <img> dalam kad HTML /lp/bangi (kad tanpa gambar sahaja).
//   node scripts/lp-bangi-image.mjs --slug limau-baby-bangi --file "/path/gambar.jpeg" [--square] [--write] [--force]
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null }
const WRITE = process.argv.includes('--write'), FORCE = process.argv.includes('--force'), SQUARE = process.argv.includes('--square')
const slug = arg('--slug'), file = arg('--file')
if (!slug || !file) { console.error('guna: --slug <slug> --file <gambar> [--square] [--write]'); process.exit(1) }
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }

const p = await one(sb.from('products').select('id, name, slug, image_url, images').eq('slug', slug).single())
if (p.image_url && !FORCE) { log(`${slug} sudah ada gambar (${p.image_url}) — guna --force untuk ganti`); process.exit(0) }

const src = sharp(readFileSync(file)).rotate()
const meta = await src.metadata()
let img = src
if (SQUARE) { const s = Math.min(meta.width, meta.height); img = img.extract({ left: Math.floor((meta.width - s) / 2), top: Math.floor((meta.height - s) * 0.35), width: s, height: s }) }
const buf = await img.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
const out = await sharp(buf).metadata()
log(`${file}: ${meta.width}x${meta.height} ${meta.format} → ${out.width}x${out.height} webp ${(buf.length / 1024).toFixed(0)}KB${SQUARE ? ' (crop 1:1)' : ''}`)

const path = `${Date.now()}-${slug}.webp`
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
log(`upload → product-images/${path}`)
if (WRITE) {
  const { error } = await sb.storage.from('product-images').upload(path, buf, { contentType: 'image/webp', upsert: false })
  if (error) throw new Error('upload: ' + error.message)
  await one(sb.from('products').update({ image_url: url, images: [url] }).eq('id', p.id))
  log(`products.${slug}.image_url dikemas kini`)
}

// Kad LP bangi tanpa <img> untuk produk ini → tambah
const lp = await one(sb.from('landing_pages').select('id, html_content').eq('slug', 'bangi').single())
const anchor = `<div class="bg-card">\n      <div class="b"><div class="n">${p.name}</div>`
const n = lp.html_content.split(anchor).length - 1
if (n === 0) log(`kad HTML "${p.name}" tanpa gambar tiada (mungkin dah bergambar) — langkau`)
else if (n > 1) throw new Error(`anchor kad x${n}`)
else {
  const html = lp.html_content.replace(anchor, `<div class="bg-card">\n      <img src="${url}" alt="${p.name}" loading="lazy">\n      <div class="b"><div class="n">${p.name}</div>`)
  log(`kad HTML "${p.name}" dapat <img>`)
  if (WRITE) await one(sb.from('landing_pages').update({ html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
}
log(WRITE ? 'SIAP (LP cache 60s).' : 'Dry-run tamat.')
