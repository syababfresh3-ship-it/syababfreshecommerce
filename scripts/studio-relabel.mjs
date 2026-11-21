// Tukar label gred pada tile studio "Syabab Dates" (1080×1080) kepada nama produk yang dijual sekarang.
// Label asal: teks kapital berjarak, dijajar KANAN (hujung x≈690) di bawah logo, tinggi huruf 19px, dasar y=144.
// Kaedah: tutup label lama dgn jalur latar tile itu sendiri (y150–176 diregang) → render teks baharu dgn Chrome headless
// (fon sistem Avenir Next, ditentukur automatik supaya tinggi huruf, lebar & kedudukan sepadan) → JPEG.
// Guna: node scripts/studio-relabel.mjs [--dir SRC] [--out DST] [--font "Avenir Next"] [--only 35,36]
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d }
const DIR = arg('--dir', path.join(os.homedir(), 'Syabab Studio', 'kurma'))
const OUT = arg('--out', path.join(os.homedir(), 'Syabab Studio', 'kurma-nama-semasa'))
const FONT = arg('--font', 'Avenir Next'), WEIGHT = arg('--weight', '500')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'relabel-'))
// Label lama (seperti dicetak) → nama jualan semasa. Fail lain disalin tanpa ubah.
const RELABEL = {
  'photo_2026-11-21 08.50.01.jpeg': ['AJWA MIX', 'AJWA ALIYAH'],
  'photo_2026-11-21 08.50.02.jpeg': ['AJWA MIX', 'AJWA ALIYAH'],
  'photo_2026-11-21 08.50.26.jpeg': ['SAFAWI LARGE', 'SAFAWI AA'],
  'photo_2026-11-21 08.50.27.jpeg': ['SAFAWI LARGE', 'SAFAWI AA'],
  'photo_2026-11-21 08.50.47.jpeg': ['AJWA AAA', 'AJWA VIP'],
  'photo_2026-11-21 08.50.48.jpeg': ['AJWA AAA', 'AJWA VIP'],
  'photo_2026-11-21 08.50.50.jpeg': ['KURMA SUKKARI', 'DRY SUKKARI'],
  'photo_2026-11-21 08.50.54.jpeg': ['AJWA MEDIUM', 'AJWA A'],
  'photo_2026-11-21 08.50.56.jpeg': ['AJWA MEDIUM', 'AJWA A'],
}
const ONLY = arg('--only') ? new Set(arg('--only').split(',')) : null
// Geometri label asal (diukur 21 Nov 2026)
const CAP = 19, BASELINE = 144, RIGHT = 690, COVER = { left: 300, top: 118, width: 405, height: 34 }, STRIP = { left: 300, top: 150, width: 405, height: 27 }

async function cleaned(src) {   // tutup label lama dgn jalur latar di bawahnya
  const base = sharp(src).rotate()
  const strip = await base.clone().extract(STRIP).resize(COVER.width, COVER.height).png().toBuffer()
  return base.composite([{ input: strip, left: COVER.left, top: COVER.top }]).png().toBuffer()
}
async function render(bgPng, text, st) {   // st: { size, spacing, top, right }
  const bg = path.join(TMP, 'bg.png'); fs.writeFileSync(bg, bgPng)
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1080px;height:1080px;overflow:hidden;background:#fff}img{position:absolute;left:0;top:0;width:1080px;height:1080px}
  .l{position:absolute;right:${st.right}px;top:${st.top}px;font-family:'${FONT}';font-weight:${WEIGHT};font-size:${st.size}px;letter-spacing:${st.spacing}px;color:#0b0b0b;white-space:nowrap;line-height:1;-webkit-font-smoothing:antialiased}</style>
  <img src="file://${bg}"><div class="l">${text}</div>`
  const page = path.join(TMP, 'p.html'); fs.writeFileSync(page, html)
  const out = path.join(TMP, 'shot.png')
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1080', `--screenshot=${out}`, `file://${page}`], { stdio: 'ignore' })
  return fs.readFileSync(out)
}
async function bbox(png) {   // kotak sempadan piksel gelap di kawasan label (elak logo y≤108 & lencana x≥707)
  const R = { left: 40, top: 112, width: 665, height: 56 }
  const { data, info } = await sharp(png).extract(R).greyscale().raw().toBuffer({ resolveWithObject: true })
  let y0 = -1, y1 = -1, x0 = info.width, x1 = -1
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[y * info.width + x] < 150) { if (y0 < 0) y0 = y; y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x }
  return y0 < 0 ? null : { y0: R.top + y0, y1: R.top + y1, x0: R.left + x0, x1: R.left + x1, h: y1 - y0 + 1, w: x1 - x0 + 1 }
}
const origBox = async (src) => bbox(await sharp(src).rotate().png().toBuffer())

// --- Tentukur dengan label yang TIDAK berubah (AJWA AA, fail 08.50.44): tinggi huruf → saiz fon; lebar → jarak huruf; dasar/hujung kanan → offset
const calFile = path.join(DIR, 'photo_2026-11-21 08.50.44.jpeg'), calText = 'AJWA AA'
const ob = await origBox(calFile)
let st = { size: 27, spacing: 8, top: 120, right: 1080 - RIGHT }
const calBg = await cleaned(calFile)
for (let pass = 0; pass < 3; pass++) {
  const b = await bbox(await render(calBg, calText, st))
  const n = calText.length
  st = {
    size: +(st.size * CAP / b.h).toFixed(2),
    spacing: +(st.spacing + (ob.w - b.w) / (n - 1)).toFixed(2),
    top: +(st.top + (BASELINE - b.y1)).toFixed(2),
    right: +(st.right + (b.x1 - RIGHT)).toFixed(2),
  }
}
const fin = await bbox(await render(calBg, calText, st))
console.log(`tentukur "${calText}": asal y${ob.y0}-${ob.y1} x${ob.x0}-${ob.x1} (${ob.w}×${ob.h}) → render y${fin.y0}-${fin.y1} x${fin.x0}-${fin.x1} (${fin.w}×${fin.h}) | fon ${st.size}px jarak ${st.spacing}px`)

// --- Proses semua fail: tukar label yang dipetakan, salin yang lain
fs.mkdirSync(OUT, { recursive: true })
let changed = 0, copied = 0
for (const f of fs.readdirSync(DIR).filter(x => /\.jpe?g$/i.test(x)).sort()) {
  const src = path.join(DIR, f), dst = path.join(OUT, f)
  const map = RELABEL[f]
  if (!map || (ONLY && !ONLY.has(f))) { fs.copyFileSync(src, dst); copied++; continue }
  const png = await render(await cleaned(src), map[1], st)
  await sharp(png).jpeg({ quality: 93, mozjpeg: true }).toFile(dst)
  const b = await bbox(png)
  console.log(`${f}: ${map[0]} → ${map[1]} (render ${b.w}×${b.h} @ x${b.x0}-${b.x1} y${b.y0}-${b.y1})`)
  changed++
}
console.log(`SIAP: ${changed} label ditukar, ${copied} disalin → ${OUT}`)
