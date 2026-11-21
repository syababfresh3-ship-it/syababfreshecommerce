// Langgan app Meta kita (Syababfresh Poster) ke satu WABA supaya mesej nombor dalam WABA itu sampai ke webhook
// /api/whatsapp/webhook. Perlu bila nombor baharu masuk WABA BAHARU (Embedded Signup kadang-kadang tak langgan app
// secara automatik — kes nombor #3 "Syabab Fresh CikFar", WABA 1838884260573496, 21 Nov 2026).
// Guna: node scripts/wa-subscribe-waba.mjs <WABA_ID>   (token dibaca dari .env.local, tidak dicetak)
import fs from 'node:fs'
import path from 'node:path'

const WABA = process.argv[2]
if (!/^\d{10,20}$/.test(WABA ?? '')) { console.error('Guna: node scripts/wa-subscribe-waba.mjs <WABA_ID>'); process.exit(1) }
const env = {}
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const tok = env.WHATSAPP_TOKEN || env.WHATSAPP_ACCESS_TOKEN
if (!tok) { console.error('WHATSAPP_TOKEN tiada dalam .env.local'); process.exit(1) }
const H = { Authorization: `Bearer ${tok}` }
const base = `https://graph.facebook.com/v21.0/${WABA}/subscribed_apps`

const post = await fetch(base, { method: 'POST', headers: H })
const pj = await post.json()
console.log('POST subscribed_apps →', post.status, JSON.stringify(pj))
const get = await fetch(base, { headers: H })
const gj = await get.json()
const apps = (gj.data ?? []).map(a => `${a.whatsapp_business_api_data?.name} (${a.whatsapp_business_api_data?.id})`)
console.log('App dilanggan pada WABA', WABA + ':', apps.join(', ') || '(tiada)')
console.log(apps.some(a => a.includes('1773148447211861')) ? 'OK — Syababfresh Poster dilanggan; mesej akan sampai ke webhook.' : 'BELUM — app 1773148447211861 tiada dalam senarai; semak kebenaran system user ke WABA ini di Business Settings.')
