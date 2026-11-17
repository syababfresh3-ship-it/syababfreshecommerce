// Segerakkan senarai harga POS "Promo Bangi" (register HQ) dengan promo_rules.prices LP /lp/bangi.
// Peraturan (memori 14 Nov 2026): bila harga LP bangi berubah, senarai POS ini mesti ikut.
//
//   node scripts/pos-pricelist-bangi.mjs           → DRY-RUN
//   node scripts/pos-pricelist-bangi.mjs --write    → tulis (idempotent)
//
// Kunci "slug:Nama Varian" → baris (product_id, variant_id); kunci "slug" → baris variant_id null.
// Baris sedia ada yang TIDAK lagi ada dalam prices TIDAK dipadam (dilaporkan sahaja).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }

const lists = await one(sb.from('pos_price_lists').select('id, name, is_active'))
const list = lists.find(l => String(l.id).startsWith('b63efb3d')) ?? lists.find(l => /bangi/i.test(l.name ?? ''))
if (!list) { console.error('Senarai harga POS Bangi tiada. Senarai ada:', lists.map(l => `${l.id.slice(0, 8)} ${l.name}`).join(' | ')); process.exit(1) }
log(`senarai POS: "${list.name}" (${list.id})`)

const lp = await one(sb.from('landing_pages').select('promo_rules').eq('slug', 'bangi').single())
const prices = lp.promo_rules?.prices ?? {}
const slugs = [...new Set(Object.keys(prices).map(k => k.split(':')[0].toLowerCase()))]
const prods = await one(sb.from('products').select('id, slug, product_variants(id, name, deleted_at)').in('slug', slugs))
const bySlug = Object.fromEntries(prods.map(p => [p.slug, p]))
const items = await one(sb.from('pos_price_list_items').select('id, product_id, variant_id, price').eq('price_list_id', list.id))
const seen = new Set()
let ins = 0, upd = 0, same = 0
for (const [key, price] of Object.entries(prices)) {
  const i = key.indexOf(':'); const slug = (i < 0 ? key : key.slice(0, i)).toLowerCase(); const vname = i < 0 ? null : key.slice(i + 1).trim()
  const p = bySlug[slug]; if (!p) { log(`! produk ${slug} tiada — langkau`); continue }
  let vid = null
  if (vname) { const v = (p.product_variants ?? []).find(x => !x.deleted_at && x.name.toLowerCase() === vname.toLowerCase()); if (!v) { log(`! varian ${key} tiada — langkau`); continue }; vid = v.id }
  const row = items.find(x => x.product_id === p.id && (x.variant_id ?? null) === vid)
  if (row) seen.add(row.id)
  if (!row) { ins++; log(`+ ${key} = RM${price}`); if (WRITE) await one(sb.from('pos_price_list_items').insert({ price_list_id: list.id, product_id: p.id, variant_id: vid, price })) }
  else if (Number(row.price) !== Number(price)) { upd++; log(`~ ${key} RM${row.price} → RM${price}`); if (WRITE) await one(sb.from('pos_price_list_items').update({ price, updated_at: new Date().toISOString() }).eq('id', row.id)) }
  else same++
}
const orphan = items.filter(x => !seen.has(x.id))
log(`ringkasan: tambah ${ins}, ubah ${upd}, sama ${same}, baris lain tak dalam prices ${orphan.length}${orphan.length ? ' (tak dipadam)' : ''}`)
