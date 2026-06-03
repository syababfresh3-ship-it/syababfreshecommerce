// Backfill master `customers` dari semua sumber sedia ada, dedup ikut telefon.
//   node scripts/backfill-customers.mjs          → DRY-RUN (cetak sahaja)
//   node scripts/backfill-customers.mjs --write  → tulis (upsert) ke DB
//
// Identiti = phone_norm (60xxxxxxxxx). Orang tanpa telefon dilangkau (tiada
// identiti untuk dedup). Agregat (order_count/total_spend) = autoritatif:
// kira order yang BUKAN cancelled/refunded, merentas store + LP.
// Upsert TIDAK sentuh tags/is_reseller/consent (tak dihantar dalam payload).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('./.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const WRITE = process.argv.includes('--write')

function normalizePhone(phone) {
  if (!phone) return ''
  let p = String(phone).replace(/\D/g, ''); if (!p) return ''
  if (p.startsWith('0')) p = '6' + p
  if (!p.startsWith('60')) p = '60' + p
  return p
}
const DEAD = new Set(['cancelled', 'refunded'])

// person: { phone_norm, name, email, address, postcode, user_id, sources:Set, order_count, total_spend, last_order_at, first_seen_at }
const map = new Map()
function touch(phone) {
  const k = normalizePhone(phone); if (!k) return null
  let p = map.get(k)
  if (!p) { p = { phone_norm: k, name: null, email: null, address: null, postcode: null, user_id: null, sources: new Set(), order_count: 0, total_spend: 0, last_order_at: null, first_seen_at: null }; map.set(k, p) }
  return p
}
const fill = (p, f, v) => { if (v && !p[f]) p[f] = v }
const seen = (p, t) => { if (t && (!p.first_seen_at || new Date(t) < new Date(p.first_seen_at))) p.first_seen_at = t }
const ordered = (p, t) => { if (t && (!p.last_order_at || new Date(t) > new Date(p.last_order_at))) p.last_order_at = t }

// ── profiles (registered) ────────────────────────────────────────────
const { data: profiles } = await sb.from('profiles').select('id, full_name, phone, email, created_at').eq('is_admin', false)
const profileById = new Map()
let noPhoneProfiles = 0
for (const pr of profiles ?? []) {
  profileById.set(pr.id, pr)
  const p = touch(pr.phone); if (!p) { noPhoneProfiles++; continue }
  p.sources.add('store'); p.user_id = pr.id
  fill(p, 'name', pr.full_name); fill(p, 'email', pr.email)
  seen(p, pr.created_at)
}

// ── storefront orders → key ikut telefon profil ──────────────────────
const { data: orders } = await sb.from('orders').select('user_id, total, status, created_at')
for (const o of orders ?? []) {
  const pr = profileById.get(o.user_id); if (!pr?.phone) continue
  const p = touch(pr.phone); if (!p) continue
  p.sources.add('store'); seen(p, o.created_at)
  if (!DEAD.has(o.status)) { p.order_count++; p.total_spend += Number(o.total || 0); ordered(p, o.created_at) }
}

// ── LP guest orders ──────────────────────────────────────────────────
const { data: lp } = await sb.from('lp_guest_orders').select('phone, name, email, address, postcode, total, status, created_at')
for (const o of lp ?? []) {
  const p = touch(o.phone); if (!p) continue
  p.sources.add('lp')
  fill(p, 'name', o.name); fill(p, 'email', o.email); fill(p, 'address', o.address); fill(p, 'postcode', o.postcode)
  seen(p, o.created_at)
  if (!DEAD.has(o.status)) { p.order_count++; p.total_spend += Number(o.total || 0); ordered(p, o.created_at) }
}

// ── leads (belum beli) ───────────────────────────────────────────────
const { data: leads } = await sb.from('landing_page_leads').select('name, phone, created_at')
for (const l of leads ?? []) {
  const p = touch(l.phone); if (!p) continue
  p.sources.add('lead'); fill(p, 'name', l.name); seen(p, l.created_at)
}

// ── ringkasan ────────────────────────────────────────────────────────
const rows = [...map.values()].map(p => ({
  phone_norm: p.phone_norm, name: p.name, email: p.email, address: p.address, postcode: p.postcode,
  user_id: p.user_id, sources: [...p.sources], order_count: p.order_count,
  total_spend: Math.round(p.total_spend * 100) / 100, last_order_at: p.last_order_at, first_seen_at: p.first_seen_at,
}))
const bySource = {}
for (const r of rows) for (const s of r.sources) bySource[s] = (bySource[s] || 0) + 1
console.log(`profiles=${profiles?.length ?? 0} (tanpa phone dilangkau=${noPhoneProfiles}), orders=${orders?.length ?? 0}, lp=${lp?.length ?? 0}, leads=${leads?.length ?? 0}`)
console.log(`=> ${rows.length} customer unik. Pecahan sumber:`, bySource)
console.log(`   ada order (order_count>0): ${rows.filter(r => r.order_count > 0).length}, total_spend RM${rows.reduce((s, r) => s + r.total_spend, 0).toFixed(2)}`)
console.log('contoh 5:'); for (const r of rows.slice(0, 5)) console.log('  ', JSON.stringify(r))

if (!WRITE) { console.log('\nDRY-RUN — tiada tulisan. Tambah --write untuk commit.'); process.exit(0) }

// ── tulis (upsert ikut phone_norm; tak hantar tags/is_reseller/consent) ──
let ok = 0, fail = 0
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200)
  const { error } = await sb.from('customers').upsert(chunk, { onConflict: 'phone_norm' })
  if (error) { fail += chunk.length; console.error('  upsert error:', error.message) } else ok += chunk.length
}
console.log(`\nUPSERT siap: ${ok} ok, ${fail} gagal.`)
process.exit(0)
