// Pembetulan pemilik 17 Nov 2026 selepas lp-bangi-perkenalan.mjs:
//   1. Shine Muscat (Anggur Muscat) kekal RM12/kg — tiada coretan.
//   2. Persimmon RM1 sebiji → LP 4 pcs RM4 (8 pcs RM8, 12 pcs RM12 kekal); normal kekal RM1.50/biji (coret).
//   3. "Anggur Rai Or" = Anggur Red Fingers → nama, slug anggur-red-fingers-bangi, gambar dari produk kedai anggur-merah-panjang.
//   node scripts/lp-bangi-perkenalan-2.mjs [--write]   (idempotent)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }
const OLD = 'anggur-rai-or-bangi', NEW = 'anggur-red-fingers-bangi', NEW_NAME = 'Anggur Red Fingers'

// 3) Red Fingers: nama + slug + gambar
const src = await one(sb.from('products').select('image_url, images').eq('slug', 'anggur-merah-panjang').maybeSingle())
const img = src?.image_url || src?.images?.[0] || null
let rf = await one(sb.from('products').select('id, slug, name, image_url').eq('slug', OLD).maybeSingle())
if (!rf) rf = await one(sb.from('products').select('id, slug, name, image_url').eq('slug', NEW).maybeSingle())
if (!rf) throw new Error('produk Rai Or / Red Fingers tiada')
const patch = {}
if (rf.slug !== NEW) patch.slug = NEW
if (rf.name !== NEW_NAME) patch.name = NEW_NAME
if (img && rf.image_url !== img) patch.image_url = img
if (!img) log('! gambar anggur-merah-panjang tiada — nama/slug sahaja')
patch.description = 'Anggur Red Fingers (anggur merah panjang) tanpa biji, rangup & manis. Harga pancingan warga Bangi RM9.90/kg — selagi stok ada.'
log(`produk ${rf.slug} → ${JSON.stringify({ ...patch, description: patch.description ? '(dikemas kini)' : undefined })}`)
if (WRITE) await one(sb.from('products').update(patch).eq('id', rf.id))

// 1) Shine Muscat kembali RM12
const sm = await one(sb.from('products').select('id, price, product_variants(id, name, price, deleted_at)').eq('slug', 'shine-muscat-bangi').single())
if (Number(sm.price) !== 12) { log(`shine-muscat-bangi harga asas RM${sm.price} → RM12`); if (WRITE) await one(sb.from('products').update({ price: 12 }).eq('id', sm.id)) }
const smv = sm.product_variants.find(v => v.name === '1kg' && !v.deleted_at)
if (smv && Number(smv.price) !== 12) { log(`shine-muscat-bangi:1kg RM${smv.price} → RM12`); if (WRITE) await one(sb.from('product_variants').update({ price: 12 }).eq('id', smv.id)) }

// promo_rules + html
const lp = await one(sb.from('landing_pages').select('id, promo_rules, html_content').eq('slug', 'bangi').single())
const prices = { ...(lp.promo_rules?.prices ?? {}) }
if (`${OLD}:1kg` in prices) { prices[`${NEW}:1kg`] = prices[`${OLD}:1kg`]; delete prices[`${OLD}:1kg`] }
prices[`${NEW}:1kg`] = 9.9
prices['shine-muscat-bangi:1kg'] = 12
prices['sweet-persimmon-bangi:4 pcs'] = 4
const diff = Object.keys({ ...prices, ...(lp.promo_rules?.prices ?? {}) }).filter(k => prices[k] !== lp.promo_rules?.prices?.[k])
log('promo_rules.prices berubah:', diff.map(k => `${k}=${prices[k] ?? '(buang)'}`).join(', ') || '(tiada)')

let html = lp.html_content
const rep = (o, n) => { const c = html.split(o).length - 1; if (c === 0) { log(`  (anchor dah tiada, langkau) ${o.slice(0, 60)}`); return } if (c !== 1) throw new Error(`anchor x${c}: ${o.slice(0, 80)}`); html = html.replace(o, n) }
rep('<div class="bg-card">\n      <div class="b"><div class="n">Anggur Rai Or</div>',
  `<div class="bg-card">\n${img ? `      <img src="${img}" alt="${NEW_NAME}" loading="lazy">\n` : ''}      <div class="b"><div class="n">${NEW_NAME}</div>`)
rep('<div class="n">Shine Muscat</div><div class="u">1kg</div><div class="p"><b>RM13.90</b><s>RM15.90</s></div>',
  '<div class="n">Shine Muscat</div><div class="u">1kg</div><div class="p"><b>RM12</b></div>')
rep('<div class="p"><b>RM5</b><s>RM6</s><span class="u">4 biji</span></div>', '<div class="p"><b>RM4</b><s>RM6</s><span class="u">4 biji</span></div>')
rep(`sweet-persimmon-bangi,delima-bangi,anggur-jari-hitam-bangi,${OLD},`, `sweet-persimmon-bangi,delima-bangi,anggur-jari-hitam-bangi,${NEW},`)
log(`html_content ${lp.html_content.length} → ${html.length} aksara`)
if (WRITE && (diff.length || html !== lp.html_content)) {
  await one(sb.from('landing_pages').update({ promo_rules: { ...lp.promo_rules, prices }, html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
  log('landing_pages bangi dikemas kini')
}
log(WRITE ? 'SIAP — jalankan scripts/pos-pricelist-bangi.mjs --write untuk segerak POS.' : 'Dry-run tamat.')
