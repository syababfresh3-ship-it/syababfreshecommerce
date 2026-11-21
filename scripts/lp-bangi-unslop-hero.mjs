// LP Bangi — gilap hero ikut skill /unslop (21 Nov 2026, mod gilap, pemilik pilih "Gilap sahaja"):
// buang pil label huruf besar, berat 800 → 600, tajuk tanpa noktah/<br>, jarak ikut grid 4px, pil → radius ikut saiz,
// label terma tanpa huruf besar berjarak, token --cherry (salin dari LP ceri) → --green, tanda tangan: baris lokasi + ikon pin.
// Palet, poster, susunan seksyen & semua tag {{checkout}} KEKAL. Idempoten (setiap ganti mesti padan tepat 1 kali; dah ditukar → langkau).
// Guna: node scripts/lp-bangi-unslop-hero.mjs [--write]   (dry-run cetak ringkasan; --write simpan + sandaran HTML lama)
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const WRITE = process.argv.includes('--write')
const env = {}; for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim() }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: lp, error } = await sb.from('landing_pages').select('id, slug, html_content').eq('slug', 'bangi').single()
if (error || !lp) throw new Error('LP bangi tiada: ' + error?.message)
let h = lp.html_content
const before = h

const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>'
const R = [
  // 2 · warna: token hijau dinamakan dengan betul (dulu --cherry, baki LP ceri)
  ['--cherry:#2F6B2F; --cherry-dark:#1F4A1F; --cherry-light:#EAF4E4; --cherry-border:#C9DFBF;', '--green:#2F6B2F; --green-dark:#1F4A1F; --green-light:#EAF4E4; --green-border:#C9DFBF;'],
  ['var(--cherry-border)', 'var(--green-border)'], ['var(--cherry-dark)', 'var(--green-dark)'], ['var(--cherry)', 'var(--green)'],
  // 1 · jarak grid 4px
  ['.bg-hero{background:#1F4A1F;color:#fff;margin:0;padding:30px 20px 26px}', '.bg-hero{background:#1F4A1F;color:#fff;margin:0;padding:32px 20px 28px}'],
  ['.bg-sec{margin:26px 16px}', '.bg-sec{margin:24px 16px}'],
  // 3/7 · pil label dibuang → baris lokasi (tanda tangan) dengan satu ikon pin lucide 16px stroke 1.5
  ['.bg-hero .tag{display:inline-block;border:1px solid rgba(255,255,255,.4);color:#E6F0DC;font-weight:700;font-size:11px;letter-spacing:.12em;padding:5px 11px;border-radius:99px}',
   '.bg-hero .loc{display:flex;align-items:center;gap:8px;margin:16px 0 0;font-size:13px;line-height:1.4;color:#D7E6CC}\n.bg-hero .loc svg{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}'],
  // 5 · jenis: berat 800 → 600, hierarki dari saiz
  ['.bg-hero h1{font-size:27px;line-height:1.18;font-weight:800;margin:14px 0 8px;letter-spacing:-.01em}', '.bg-hero h1{font-size:28px;line-height:1.2;font-weight:600;margin:0 0 8px;letter-spacing:-.01em;max-width:16em}'],
  ['.bg-sec h2{font-size:18px;font-weight:800;', '.bg-sec h2{font-size:18px;font-weight:600;'],
  ['.bg-card .p b{font-size:20px;font-weight:800;', '.bg-card .p b{font-size:20px;font-weight:600;'],
  // 7 · butiran: radius ikut saiz, bukan semua pil; jarak kad ikut grid
  ['.bg-poster{border-radius:18px;', '.bg-poster{border-radius:16px;'],
  ['.bg-items{display:flex;flex-wrap:wrap;gap:6px 8px;margin:12px 0 0;', '.bg-items{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;'],
  ['.bg-items li{font-size:12.5px;color:#374151;background:#fff;border:1px solid #e5e7eb;border-radius:99px;padding:4px 10px}', '.bg-items li{font-size:13px;color:#374151;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:4px 10px}'],
  ['.bg-card .b{padding:10px 12px 12px}', '.bg-card .b{padding:12px}'],
  ['.bg-card .u{font-size:12px;color:#6b7280;margin-top:1px}', '.bg-card .u{font-size:12px;color:#6b7280;margin-top:2px}'],
  ['.bg-card .p{margin-top:7px;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}', '.bg-card .p{margin-top:8px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}'],
  ['.bg-card .hint{font-size:11.5px;', '.bg-card .hint{font-size:12px;'],
  ['.bg-terms span{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--green-dark);padding-top:2px}', '.bg-terms span{font-size:12px;font-weight:600;color:var(--green-dark);padding-top:2px}'],
  // 4 · salinan: tanpa pil, tajuk tanpa noktah & <br>, perenggan tak ulang alamat (alamat pindah ke baris lokasi)
  [`<div class="bg-hero">
  <span class="tag">HARGA PERKENALAN · WARGA BANGI</span>
  <h1>Buah import segar,<br>harga perkenalan untuk jiran Bangi.</h1>
  <p>Syabab Fresh ialah pengimport — stok sampai terus ke gudang kami di Seksyen 16, Bandar Baru Bangi, dan dihantar ke rumah anda dengan Lalamove.</p>
</div>`,
   `<div class="bg-hero">
  <h1>Buah import segar, harga perkenalan untuk jiran Bangi</h1>
  <p>Syabab Fresh ialah pengimport. Stok sampai terus ke gudang kami dan dihantar ke rumah anda dengan Lalamove.</p>
  <div class="loc">${PIN}<span>Gudang Seksyen 16, Bandar Baru Bangi · Penghantaran Lalamove</span></div>
</div>`],
]
let applied = 0, skipped = 0
for (const [from, to] of R) {
  const n = h.split(from).length - 1
  if (n === 1) { h = h.replace(from, to); applied++ }
  else if (n === 0 && h.includes(to.split('\n')[0].slice(0, 40))) skipped++
  else throw new Error(`Padanan ${n}× (perlu 1): ${from.slice(0, 70)}…`)
}
console.log(`ganti: ${applied} diguna, ${skipped} dah ada | panjang ${before.length} → ${h.length} | {{checkout}} kekal: ${(h.match(/\{\{checkout/g) || []).length === (before.match(/\{\{checkout/g) || []).length}`)
console.log('inline style= (tak disentuh):', [...h.matchAll(/style="([^"]*)"/g)].map(m => m[1].slice(0, 50)).join(' | '))
if (!WRITE) { console.log('(dry-run — tambah --write untuk simpan)'); process.exit(0) }
const bak = `/private/tmp/claude-501/-Users-anas--Projects-syababfresh/d068f9f8-a9ba-408e-9692-21a48eaad986/scratchpad/unslop/bangi-html-before-${Date.now()}.html`
fs.writeFileSync(bak, before)
const { error: ue } = await sb.from('landing_pages').update({ html_content: h, updated_at: new Date().toISOString() }).eq('id', lp.id)
if (ue) throw new Error(ue.message)
console.log('DISIMPAN html_content LP bangi | sandaran:', bak)
