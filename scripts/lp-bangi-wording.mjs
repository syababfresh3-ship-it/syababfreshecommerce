// 20 Nov 2026 — pemilik: "harga pancingan" ialah istilah dalaman, jangan tunjuk kepada pelanggan.
// Ganti dengan "harga istimewa" dalam html_content LP (semua LP aktif) dan deskripsi produk *-bangi.
//   node scripts/lp-bangi-wording.mjs [--write]   (dry-run lalai, idempoten)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }

const fix = (s) => s
  .replace(/Harga pancingan/g, 'Harga istimewa')
  .replace(/harga pancingan/g, 'harga istimewa')
  .replace(/HARGA PANCINGAN/g, 'HARGA ISTIMEWA')

// 1) Landing pages
const lps = await one(sb.from('landing_pages').select('id, slug, html_content').ilike('html_content', '%pancingan%'))
for (const lp of lps) {
  const n = (lp.html_content.match(/pancingan/gi) || []).length
  const next = fix(lp.html_content)
  log(`LP ${lp.slug}: ${n} sebutan → ${(next.match(/pancingan/gi) || []).length} baki`)
  if (WRITE && next !== lp.html_content) await one(sb.from('landing_pages').update({ html_content: next, updated_at: new Date().toISOString() }).eq('id', lp.id))
}
if (!lps.length) log('LP: tiada sebutan')

// 2) Produk (deskripsi)
const prods = await one(sb.from('products').select('id, slug, description').ilike('description', '%pancingan%'))
for (const p of prods) {
  const next = fix(p.description)
  log(`produk ${p.slug}: "${p.description.slice(0, 70)}…" → "${next.slice(0, 70)}…"`)
  if (WRITE && next !== p.description) await one(sb.from('products').update({ description: next }).eq('id', p.id))
}
if (!prods.length) log('produk: tiada sebutan')
log(WRITE ? 'SIAP.' : 'Dry-run tamat.')
