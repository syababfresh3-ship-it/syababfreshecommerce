// 20 Nov 2026 malam — pemilik aktifkan semula produk delima-bangi (dinamakan "Delima Tunisia - Manis & Biji Lembut")
// dan minta masukkan semula ke LP Bangi. Tambah slug ke {{checkout}} (selepas sweet-persimmon-bangi) dan satu kad grid
// selepas kad Limau Baby: 3 biji RM10 (RM13.50), 2 biji RM7.50 (RM9), 1 biji RM4.50 — ikut promo_rules.prices sedia ada.
// Tidak dimasukkan semula ke seksyen "Kuota terhad".
//   node scripts/lp-bangi-readd-delima.mjs [--write]   (dry-run lalai, idempoten)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')
const log = (...a) => console.log(WRITE ? '[WRITE]' : '[DRY]', ...a)
async function one(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data }

const p = await one(sb.from('products').select('id, name, image_url, is_active, product_variants(name, price, deleted_at)').eq('slug', 'delima-bangi').single())
if (!p.is_active) { log('produk delima-bangi tidak aktif → aktifkan'); if (WRITE) await one(sb.from('products').update({ is_active: true }).eq('id', p.id)) }
const lp = await one(sb.from('landing_pages').select('id, html_content, promo_rules').eq('slug', 'bangi').single())
const prices = lp.promo_rules?.prices ?? {}
const v = Object.fromEntries(p.product_variants.filter(x => !x.deleted_at).map(x => [x.name, Number(x.price)]))
const rm = (n) => 'RM' + (Number.isInteger(n) ? n : n.toFixed(2))
const line = (name) => {
  const promo = prices[`delima-bangi:${name}`], base = v[name]
  if (base == null) return ''
  const price = promo ?? base
  return `<div class="p"${name === '3 biji' ? '' : ' style="margin-top:2px"'}><b>${rm(price)}</b>${promo != null && promo < base ? `<s>${rm(base)}</s>` : ''}<span class="u">${name}</span></div>`
}
const CARD = `\n    <div class="bg-card">\n      <img src="${p.image_url}" alt="Delima Tunisia" loading="lazy">\n      <div class="b"><div class="n">Delima Tunisia</div><div class="u">Manis &amp; biji lembut</div>${line('3 biji')}${line('2 biji')}${line('1 biji')}</div>\n    </div>`

let html = lp.html_content
if (/alt="Delima/.test(html)) log('kad Delima sudah ada — langkau')
else {
  const i = html.indexOf('<div class="n">Limau Baby</div>')
  if (i < 0) throw new Error('kad Limau Baby tiada — anchor gagal')
  const close = html.indexOf('\n    </div>', i)
  html = html.slice(0, close + '\n    </div>'.length) + CARD + html.slice(close + '\n    </div>'.length)
  log('kad Delima Tunisia ditambah selepas Limau Baby')
}
if (!/\{\{checkout:[^}]*\bdelima-bangi\b/.test(html)) {
  html = html.replace(/\{\{checkout:([^}]*)\}\}/, (m, inner) => {
    const list = inner.split(',').map(s => s.trim()).filter(Boolean)
    const at = list.indexOf('sweet-persimmon-bangi')
    list.splice(at >= 0 ? at + 1 : list.length, 0, 'delima-bangi')
    return `{{checkout:${list.join(',')}}}`
  })
  log('slug delima-bangi dimasukkan ke checkout')
} else log('slug delima-bangi sudah ada dalam checkout')
log('kad:', CARD.replace(/\s+/g, ' ').slice(0, 260))
if (WRITE && html !== lp.html_content) {
  await one(sb.from('landing_pages').update({ html_content: html, updated_at: new Date().toISOString() }).eq('id', lp.id))
  log('landing_pages bangi dikemas kini')
}
log(WRITE ? 'SIAP.' : 'Dry-run tamat.')
