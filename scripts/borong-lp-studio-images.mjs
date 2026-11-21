// Pasang foto studio "Syabab Dates" (karton/dulang) sebagai IMEJ KHAS LP BORONG (borong_pricing.images, slug → URL).
// Gambar produk kedai TIDAK disentuh. Jalur jenama atas/bawah tile dipotong (produk sahaja) supaya object-cover LP tak memotong teks.
// Guna: node scripts/borong-lp-studio-images.mjs [--dir "/Users/anas./Syabab Studio/kurma"] [--no-crop] [--write]
//   tanpa --write = dry-run: pratonton WebP ditulis ke scratchpad/studio-out/ untuk semakan.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d }
const WRITE = process.argv.includes('--write'), CROP = !process.argv.includes('--no-crop')
const DIR = arg('--dir', '/Users/anas./Syabab Studio/kurma')
const OUT = arg('--out', '/private/tmp/claude-501/-Users-anas--Projects-syababfresh/d068f9f8-a9ba-408e-9692-21a48eaad986/scratchpad/studio-out')
// slug katalog borong → fail foto (label tile dalam kurungan). Tiada foto: safawi-medium (Safawi A), rotab-sukkari, kurma-tunisia, libya.
const MAP = {
  'ajwa-medium': 'photo_2026-11-21 08.50.54.jpeg',           // AJWA MEDIUM (dulang) = gred A
  'ajwa-aa-premium': 'photo_2026-11-21 08.50.44.jpeg',       // AJWA AA (dulang)
  'ajwa-large': 'photo_2026-11-21 08.50.57.jpeg',            // AJWA LARGE (dulang)
  'ajwa-aliyah-mix': 'photo_2026-11-21 08.50.01.jpeg',       // AJWA MIX (dulang)
  'ajwa-jumbo': 'photo_2026-11-21 08.51.00.jpeg',            // AJWA JUMBO (dulang)
  'ajwa-super-jumbo-vip': 'photo_2026-11-21 08.50.47.jpeg',  // AJWA AAA (dulang) — dianggap = VIP
  'mariami-a': 'photo_2026-11-21 08.51.16.jpeg',             // MARIAMI A (dulang)
  'mariami-aa': 'photo_2026-11-21 08.51.18.jpeg',            // MARIAMI AA (karton)
  'mariami-aaa': 'photo_2026-11-21 08.51.19.jpeg',           // MARIAMI AAA (dulang)
  'safawi-large': 'photo_2026-11-21 08.50.26.jpeg',          // SAFAWI LARGE (kotak emas) = gred AA
  'safawi-jumbo': 'photo_2026-11-21 08.50.52.jpeg',          // SAFAWI JUMBO (kotak emas)
  'medjoul-palestine-large': 'photo_2026-11-21 08.49.58.jpeg', // MEDJOUL LARGE (dulang)
  'medjoul-palestine-jumbo': 'photo_2026-11-21 08.49.55.jpeg', // MEDJOUL JUMBO (dulang)
  'mabroom': 'photo_2026-11-21 08.50.24.jpeg',               // MABROOM (dulang)
  'dry-sukkari': 'photo_2026-11-21 08.50.50.jpeg',           // KURMA SUKKARI (dulang) — dianggap Dry Sukkari
}
const env = {}; for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
fs.mkdirSync(OUT, { recursive: true })

const { data: ps } = await sb.from('products').select('slug, name, is_active').in('slug', Object.keys(MAP))
const { data: st } = await sb.from('app_settings').select('value').eq('key', 'borong_pricing').maybeSingle()
const settings = st?.value ? JSON.parse(st.value) : {}
const images = { ...(settings.images ?? {}) }
const stamp = Date.now()
for (const [slug, file] of Object.entries(MAP)) {
  const p = ps.find(x => x.slug === slug)
  const src = path.join(DIR, file)
  if (!fs.existsSync(src)) { console.log('LANGKAU', slug, '— fail tiada:', file); continue }
  let img = sharp(src).rotate()
  const meta = await img.metadata()
  // Tile 1080×1080: jenama + label gred ~0–160px atas, "FAST DELIVERY…" ~1000–1080px bawah → simpan 170..1000 (disemak visual 21 Nov)
  if (CROP && meta.width === 1080 && meta.height === 1080) img = img.extract({ left: 0, top: 170, width: 1080, height: 830 })
  const buf = await img.webp({ quality: 82 }).toBuffer()
  const outMeta = await sharp(buf).metadata()
  const name = `${stamp}-lp-borong-${slug}.webp`
  fs.writeFileSync(path.join(OUT, `${slug}.webp`), buf)
  console.log(`${slug.padEnd(24)} ${(p?.name ?? '?').padEnd(28)} ${file.slice(17, 25)} → ${outMeta.width}x${outMeta.height} ${(buf.length / 1024).toFixed(0)}KB${p?.is_active === false ? ' (produk TAK AKTIF — LP langkau)' : ''}`)
  if (!WRITE) continue
  const { error } = await sb.storage.from('product-images').upload(name, buf, { contentType: 'image/webp', upsert: false })
  if (error) throw new Error(`upload ${slug}: ${error.message}`)
  images[slug] = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${name}`
}
if (WRITE) {
  const next = { ...settings, images }
  const { error } = await sb.from('app_settings').upsert({ key: 'borong_pricing', value: JSON.stringify(next) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  console.log(`DISIMPAN borong_pricing.images: ${Object.keys(images).length} produk`)
} else console.log(`(dry-run — pratonton di ${OUT}; tambah --write untuk upload & simpan)`)
