// ============================================================
// lp-html — imbangkan bahagian HTML LP di sekeliling placeholder ({{checkout:…}}, {{product:…}}, …).
//
// Punca (12 Nov 2026, LP promo-fresh-figs): pengarang/templat letak placeholder DALAM kotak pembalut
//   <div class="box"><div>{{checkout:…}}</div></div>
// page.tsx memecah html_content pada placeholder → bahagian sebelum tamat dengan <div> belum tutup,
// bahagian selepas bermula dengan </div>. Browser menutup <div data-lp-html> bekas lebih awal, komponen
// React seterusnya (borang checkout) jatuh ke dalam kotak → DOM ≠ pokok React → "Hydration failed",
// React bina semula di klien (layout lompat, SSR terbuang).
//
// Peraturan (pure, tiada DOM):
//  • pembalut yang KOSONG selepas placeholder dibuang (buka & tutupnya) — placeholder "menggantikan" kotak;
//  • pembalut yang ada kandungan lain ditutup di hujung bahagian, penutupnya di bahagian seterusnya digugurkan;
//  • <script>/<style>/komen dilangkau (teks "<div>" dalam CSS/JS bukan tag); tag void/self-closing diabaikan;
//  • penutup sesat yang tak sepadan dibiarkan (browser pun abaikan).
// HTML tanpa placeholder tidak diubah langsung.
// ============================================================

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const TOKEN = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/gi

interface Open { tag: string; start: number; end: number }

/** Jalankan tokenizer atas satu bahagian HTML. `pending` = penutup yang dijangka di awal (tag yang ditutup/dibuang
 *  di bahagian sebelumnya, susunan dalam → luar). Pulangkan HTML baharu + tag yang masih terbuka di hujung. */
function processChunk(html: string, pending: string[]): { html: string; open: Open[]; expect: string[] } {
  const stack: Open[] = []
  const drop: [number, number][] = []     // julat teks untuk dibuang (penutup lebihan di awal)
  const expect = [...pending]             // LIFO: expect[0] = paling dalam = penutup pertama yang dijangka
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(html))) {
    if (m[0].startsWith('<!--') || m[1]) continue
    const raw = m[0]
    const tag = m[2].toLowerCase()
    if (raw.startsWith('</')) {
      const at = stack.map(s => s.tag).lastIndexOf(tag)
      if (at >= 0) { stack.length = at; continue }            // tutup sehingga tag sepadan (gaya parser HTML)
      // Tiada pembuka dalam bahagian ini: penutup untuk pembalut bahagian sebelumnya? → gugurkan
      if (expect.length && expect[0] === tag) { expect.shift(); drop.push([m.index, m.index + raw.length]) }
      continue
    }
    if (VOID.has(tag) || /\/\s*>$/.test(raw)) continue
    stack.push({ tag, start: m.index, end: m.index + raw.length })
  }
  if (!drop.length) return { html, open: stack, expect }
  let out = '', last = 0
  for (const [a, b] of drop) { out += html.slice(last, a); last = b }
  out += html.slice(last)
  // Indeks `open` merujuk HTML asal; penutup yang digugurkan sentiasa SEBELUM mana-mana pembuka yang masih terbuka
  const shift = drop.reduce((n, [a, b]) => n + (b - a), 0)
  return { html: out, open: stack.map(o => ({ ...o, start: o.start - shift, end: o.end - shift })), expect }
}

/** parts = hasil html.split(regex placeholder) — indeks genap HTML, ganjil placeholder. Pulangkan salinan seimbang. */
export function balanceLpParts(parts: string[]): string[] {
  if (parts.length < 3) return parts
  const out = [...parts]
  let pending: string[] = []
  for (let i = 0; i < out.length; i += 2) {
    const isLast = i === out.length - 1
    const { html, open, expect } = processChunk(out[i], pending)
    let chunk = html
    // Penutup yang belum dijumpai (cth bahagian kosong antara dua placeholder) terus dijangka di bahagian seterusnya
    const carry: string[] = []
    if (open.length && !isLast) {
      // Dari yang paling dalam: pembalut kosong (hanya ruang putih selepas pembuka) dibuang terus;
      // yang berisi ditutup di hujung. Kedua-dua perlukan penutupnya digugurkan di bahagian seterusnya.
      const closers: string[] = []
      for (let k = open.length - 1; k >= 0; k--) {
        const o = open[k]
        carry.push(o.tag)
        if (chunk.slice(o.end).trim() === '') chunk = chunk.slice(0, o.start) + chunk.slice(o.end)
        else closers.push(`</${o.tag}>`)
      }
      chunk = chunk.replace(/\s+$/, '') + closers.join('') + (closers.length ? '\n' : '')
    }
    pending = [...carry, ...expect]   // pembalut baharu (dalam) dahulu, kemudian baki yang dijangka dari sebelumnya
    out[i] = chunk
  }
  return out
}
