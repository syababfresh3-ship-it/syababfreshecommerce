// Tukar GAMBAR UTAMA produk kurma kedai kepada foto studio (versi produk sahaja — URL sama yang dipakai LP borong,
// borong_pricing.images) + masukkan tile berjenama penuh (label nama semasa, folder kurma-nama-semasa) sebagai galeri pertama.
// Gambar utama lama tidak dibuang — dipindah ke hujung galeri. Kesan: kurma.syababfresh.my/shop, shop.syababfresh.my, POS.
// Guna: node scripts/kurma-shop-studio-images.mjs [--dir "~/Syabab Studio/kurma-nama-semasa"] [--only slug,slug] [--write]
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d }
const WRITE = process.argv.includes('--write')
const DIR = arg('--dir', path.join(os.homedir(), 'Syabab Studio', 'kurma-nama-semasa'))
// slug → fail tile (sama seperti scripts/borong-lp-studio-images.mjs)
const MAP = {
  'ajwa-medium': 'photo_2026-11-21 08.50.54.jpeg', 'ajwa-aa-premium': 'photo_2026-11-21 08.50.44.jpeg', 'ajwa-large': 'photo_2026-11-21 08.50.57.jpeg',
  'ajwa-aliyah-mix': 'photo_2026-11-21 08.50.01.jpeg', 'ajwa-jumbo': 'photo_2026-11-21 08.51.00.jpeg', 'ajwa-super-jumbo-vip': 'photo_2026-11-21 08.50.47.jpeg',
  'mariami-a': 'photo_2026-11-21 08.51.16.jpeg', 'mariami-aa': 'photo_2026-11-21 08.51.18.jpeg', 'mariami-aaa': 'photo_2026-11-21 08.51.19.jpeg',
  'safawi-large': 'photo_2026-11-21 08.50.26.jpeg', 'safawi-jumbo': 'photo_2026-11-21 08.50.52.jpeg',
  'medjoul-palestine-large': 'photo_2026-11-21 08.49.58.jpeg', 'medjoul-palestine-jumbo': 'photo_2026-11-21 08.49.55.jpeg',
  'mabroom': 'photo_2026-11-21 08.50.24.jpeg', 'dry-sukkari': 'photo_2026-11-21 08.50.50.jpeg',
  // Produk kedai di luar katalog borong (tiada imej LP) — versi produk-sahaja dipotong & diupload di sini
  'safawi-jumbo-premium-kotak': 'photo_2026-11-21 08.50.53.jpeg',   // SAFAWI JUMBO kotak emas (tumpah) — "Premium (Kotak)"
  // Safawi A tiada foto sendiri — pemilik (21 Nov): "pakai je safawi yang ada" → foto Safawi Large (tumpah), TANPA tile berjenama
  // dalam galeri sebab labelnya "SAFAWI AA"; gambar utama versi produk-sahaja (tiada label) sahaja.
  'safawi-medium': { file: 'photo_2026-11-21 08.50.27.jpeg', tile: false },
}
const ONLY = arg('--only') ? new Set(arg('--only').split(',')) : null
const env = {}; for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const PUB = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/`

const { data: st } = await sb.from('app_settings').select('value').eq('key', 'borong_pricing').maybeSingle()
const lpImages = st?.value ? (JSON.parse(st.value).images ?? {}) : {}
const { data: ps } = await sb.from('products').select('id, slug, name, image_url, images').in('slug', Object.keys(MAP))
const stamp = Date.now()
let n = 0
for (const [slug, spec] of Object.entries(MAP)) {
  const file = typeof spec === 'string' ? spec : spec.file, withTile = typeof spec === 'string' ? true : spec.tile !== false
  const p = ps.find(x => x.slug === slug); const src = path.join(DIR, file)
  if (ONLY && !ONLY.has(slug)) continue
  if (!p) { console.log('LANGKAU', slug, '— produk tiada'); continue }
  if (!fs.existsSync(src)) { console.log('LANGKAU', slug, '— fail tiada:', file); continue }
  const tile = await sharp(src).rotate().webp({ quality: 82 }).toBuffer()
  const tileName = `${stamp}-tile-${slug}.webp`, tileUrl = PUB + tileName
  // Gambar utama = versi produk-sahaja: URL LP jika ada, jika tidak potong sendiri (jalur jenama 170..1000, sama seperti skrip LP)
  let mainUrl = lpImages[slug] ?? null, mainBuf = null, mainName = null
  if (!mainUrl) { mainBuf = await sharp(src).rotate().extract({ left: 0, top: 170, width: 1080, height: 830 }).webp({ quality: 82 }).toBuffer(); mainName = `${stamp}-studio-${slug}.webp`; mainUrl = PUB + mainName }
  const oldMain = p.image_url, oldGallery = Array.isArray(p.images) ? p.images : []
  const gallery = [...(withTile ? [tileUrl] : []), ...oldGallery.filter(u => u && u !== mainUrl && u !== oldMain && !/-tile-/.test(u)), ...(oldMain && oldMain !== mainUrl ? [oldMain] : [])].slice(0, 12)
  console.log(`${slug.padEnd(26)} ${p.name.padEnd(30)} utama → studio${mainBuf ? ' (potong baharu)' : ' (LP)'} | galeri: ${withTile ? 'tile berjenama + ' : 'TANPA tile + '}${oldGallery.length} lama + utama lama = ${gallery.length}${withTile ? ` | tile ${(tile.length / 1024).toFixed(0)}KB` : ''}`)
  if (!WRITE) continue
  if (withTile) { const { error: ue } = await sb.storage.from('product-images').upload(tileName, tile, { contentType: 'image/webp', upsert: false }); if (ue) throw new Error(`upload ${slug}: ${ue.message}`) }
  if (mainBuf) { const { error: me } = await sb.storage.from('product-images').upload(mainName, mainBuf, { contentType: 'image/webp', upsert: false }); if (me) throw new Error(`upload utama ${slug}: ${me.message}`) }
  const { error } = await sb.from('products').update({ image_url: mainUrl, images: gallery, updated_at: new Date().toISOString() }).eq('id', p.id)
  if (error) throw new Error(`update ${slug}: ${error.message}`)
  n++
}
console.log(WRITE ? `DISIMPAN: ${n} produk dikemas kini` : '(dry-run — tambah --write untuk upload & simpan)')
