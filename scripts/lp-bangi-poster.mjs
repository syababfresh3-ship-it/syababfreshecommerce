// Pasang poster "Kotak Buah Keluarga RM45" (versi baharu pemilik, isi Limau Baby) ke LP Bangi + gambar produk.
//   node scripts/lp-bangi-poster.mjs --file "/path/poster.png" [--write]
// Langkah: PNG → WebP ≤1200px lebar → upload product-images → products.kotak-buah-keluarga.image_url/images
//          → blok .bg-poster dalam html_content (sisip sebelum <ul class="bg-items"> jika tiada, ganti jika ada).
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null }
const file = arg('--file')
if (!file) { console.error('guna: --file <poster> [--write]'); process.exit(1) }
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }

const ALT = 'Kotak Buah Keluarga RM45 — Shine Muscat, Mata Kucing, Ubi Jepun, Sweet Persimmon, Limau Baby'
const buf = await sharp(file).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
const meta = await sharp(buf).metadata()
log(`poster → webp ${meta.width}x${meta.height} ${Math.round(buf.length / 1024)}KB`)

let url = null
if (WRITE) {
  const path = `${Date.now()}-kotakbuahrm45-limau.webp`
  const { error } = await sb.storage.from('product-images').upload(path, buf, { contentType: 'image/webp' })
  if (error) throw new Error(error.message)
  url = sb.storage.from('product-images').getPublicUrl(path).data.publicUrl
  log('dimuat naik:', url)
} else url = 'https://…/product-images/<ts>-kotakbuahrm45-limau.webp'

const p = await one(sb.from('products').select('id, image_url').eq('slug', 'kotak-buah-keluarga').single())
log(`produk kotak-buah-keluarga image_url: ${p.image_url ?? '(kosong)'} → poster baharu`)
if (WRITE) await one(sb.from('products').update({ image_url: url, images: [url] }).eq('id', p.id))

const lp = await one(sb.from('landing_pages').select('id, html_content').eq('slug', 'bangi').single())
let html = lp.html_content
const block = `  <div class="bg-poster">\n    <img src="${url}" alt="${ALT}" width="${meta.width}" height="${meta.height}">\n  </div>\n`
if (/<div class="bg-poster">[\s\S]*?<\/div>\n/.test(html)) {
  html = html.replace(/  <div class="bg-poster">[\s\S]*?<\/div>\n/, block)
  log('blok .bg-poster sedia ada diganti')
} else {
  const anchor = '  <ul class="bg-items">'
  const n = html.split(anchor).length - 1
  if (n !== 1) throw new Error(`anchor <ul class="bg-items"> x${n}`)
  html = html.replace(anchor, block + anchor)
  log('blok .bg-poster disisip sebelum senarai isi kotak')
}
if (WRITE) {
  await one(sb.from('landing_pages').update({ html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
  log('landing_pages bangi dikemas kini')
}
log(WRITE ? 'SIAP.' : 'Dry-run tamat.')
