// Optimize imej sedia ada di Supabase Storage → resize (max 1600px) + WebP.
// Tujuan: berhenti bergantung pada Supabase image transformation (jimat kuota Pro).
// Overwrite path SAMA → URL kekal, tiada link rosak. contentType = image/webp.
//
//   node scripts/backfill-image-webp.mjs           → DRY-RUN (senarai + kira sahaja)
//   node scripts/backfill-image-webp.mjs --write    → overwrite sebenar
//
// Skop: bucket 'product-images' (semua) + 'brand-assets/lp-images' (kandungan LP).
// SENGAJA tak sentuh top-level brand-assets (og-image/logo/favicon — dirujuk terus
// di meta tag, bukan via next/image; tukar boleh rosakkan social preview).
// Langkau SVG (vektor) & GIF (animasi hilang). Imej webp kecil sedia ada dilangkau.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')

const TARGETS = [
  { bucket: 'product-images', prefix: '' },
  { bucket: 'brand-assets', prefix: 'lp-images' },
]
const MAX_W = 1600
const QUALITY = 80
const SKIP_EXT = new Set(['svg', 'gif'])
const ALREADY_OK_KB = 200 // webp sedia ada bawah saiz ini dianggap dah optimize → langkau

const ext = (p) => (p.split('.').pop() || '').toLowerCase()
const kb = (n) => (n / 1024).toFixed(0)

async function listAll(bucket, prefix = '') {
  const out = []
  let offset = 0
  for (;;) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null || item.metadata == null) out.push(...await listAll(bucket, path)) // folder → recurse
      else out.push({ path, size: item.metadata?.size ?? 0 })
    }
    if (data.length < 100) break
    offset += 100
  }
  return out
}

let before = 0, after = 0, processed = 0, skipped = 0, failed = 0

for (const { bucket, prefix } of TARGETS) {
  let files
  try { files = await listAll(bucket, prefix) } catch (e) { console.log(`bucket ${bucket}: ${e.message}`); continue }
  console.log(`\n=== ${bucket}${prefix ? '/' + prefix : ''}: ${files.length} fail ===`)
  for (const f of files) {
    const e = ext(f.path)
    if (SKIP_EXT.has(e)) { skipped++; continue }
    if (e === 'webp' && f.size > 0 && f.size / 1024 < ALREADY_OK_KB) { skipped++; continue }

    const { data: blob, error: dErr } = await sb.storage.from(bucket).download(f.path)
    if (dErr || !blob) { console.log(`  ✗ download gagal: ${f.path}`); failed++; continue }
    const buf = Buffer.from(await blob.arrayBuffer())

    let outBuf
    try {
      outBuf = await sharp(buf).rotate().resize({ width: MAX_W, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer()
    } catch (err) { console.log(`  ✗ sharp gagal: ${f.path} (${err.message})`); failed++; continue }

    // Jangan overwrite kalau hasil LEBIH besar (jarang; cth imej dah sangat kecil)
    if (outBuf.length >= buf.length) { skipped++; continue }

    before += buf.length; after += outBuf.length; processed++
    console.log(`  ${WRITE ? '↻' : '·'} ${f.path}  ${kb(buf.length)}KB → ${kb(outBuf.length)}KB (-${((1 - outBuf.length / buf.length) * 100).toFixed(0)}%)`)

    if (WRITE) {
      const { error: uErr } = await sb.storage.from(bucket).upload(f.path, outBuf, { upsert: true, contentType: 'image/webp' })
      if (uErr) { console.log(`    ✗ upload gagal: ${uErr.message}`); failed++ }
    }
  }
}

console.log(`\n— ${WRITE ? 'DAH TULIS' : 'DRY-RUN'} —`)
console.log(`Proses: ${processed} · Langkau: ${skipped} · Gagal: ${failed}`)
const savePct = before ? ((1 - after / before) * 100).toFixed(0) : 0
console.log(`Saiz: ${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB (jimat ${savePct}%)`)
if (!WRITE) console.log('\n👉 Jalankan dengan --write untuk overwrite sebenar.')
