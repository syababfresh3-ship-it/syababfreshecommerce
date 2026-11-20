// 20 Nov 2026 — pemilik: buang Delima dari LP Bangi.
// Buang 2 kad Delima (Kuota terhad 3 biji + grid 2/1 biji), slug delima-bangi dari {{checkout}},
// dan nyahaktifkan produk delima-bangi (checkout LP & POS sorok produk tak aktif).
// TIDAK disentuh: promo_rules.prices (kunci delima kekal untuk pulih), POS "Promo Bangi", produk kedai delima-tunisia.
//   node scripts/lp-bangi-remove-delima.mjs [--write]   (dry-run lalai, idempoten)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }

const lp = await one(sb.from('landing_pages').select('id, html_content').eq('slug', 'bangi').single())
let html = lp.html_content
// Kad .bg-card yang gambarnya alt="Delima" — blok ditutup oleh "\n    </div>" (indent 4 ruang).
const cardRe = /\n    <div class="bg-card">\n      <img[^>]*alt="Delima"[^>]*>\n[\s\S]*?\n    <\/div>/g
const cards = html.match(cardRe) || []
log(`kad Delima dijumpai: ${cards.length}`)
html = html.replace(cardRe, '')
const before = html
html = html.replace(/\{\{checkout:([^}]*)\}\}/, (m, inner) => `{{checkout:${inner.split(',').map((s) => s.trim()).filter((s) => s && s !== 'delima-bangi').join(',')}}}`)
log(`slug delima-bangi dalam checkout: ${before === html ? 'tiada' : 'dibuang'}`)
const left = (html.match(/delima/gi) || []).length
log(`sebutan "delima" baki dalam html: ${left}`)
if (WRITE && html !== lp.html_content) {
  await one(sb.from('landing_pages').update({ html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
  log('landing_pages bangi dikemas kini')
}

const p = await one(sb.from('products').select('id, is_active').eq('slug', 'delima-bangi').maybeSingle())
if (!p) log('produk delima-bangi tiada')
else {
  log(`produk delima-bangi is_active ${p.is_active} → false`)
  if (WRITE && p.is_active) await one(sb.from('products').update({ is_active: false }).eq('id', p.id))
}
log(WRITE ? 'SIAP.' : 'Dry-run tamat.')
