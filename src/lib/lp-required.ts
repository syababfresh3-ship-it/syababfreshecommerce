// ============================================================
// lp-required — produk WAJIB dalam seksyen checkout landing page.
//
// Sesetengah LP dibina untuk mempromosi SATU produk (cth LP figs). Add-on
// hanya masuk akal sebagai tambahan kepada produk itu — pelanggan tidak
// sepatutnya boleh membeli add-on sahaja.
//
// Ditanda dengan `*` pada hujung slug di dalam tag checkout:
//
//   {{checkout:fresh-figs-bursa-jumbo*,mangga-harum,pisang-berangan}}
//                                   ↑ wajib
//
// Tanpa `*` tiada apa berubah — setiap LP sedia ada berkelakuan betul-betul
// seperti sebelum ini. Itu sengaja: peraturan ini opt-in per LP.
//
// Fungsi di sini dipakai oleh DUA pihak:
//   • lp/[slug]/page.tsx      → tahu produk mana nak kelabukan dalam borang
//   • api/lp/[slug]/order     → tolak POST yang tiada produk wajib
//
// Dua-dua membaca `html_content` yang SAMA, jadi apa yang dipapar dan apa
// yang diterima tidak boleh terpisah — sama seperti corak lib/lp-payment.ts.
// ============================================================

export interface CheckoutSlug {
  slug: string
  required: boolean
}

/** Hurai isi dalam `{{checkout:...}}` (tanpa pembalut tag). */
export function parseCheckoutSlugs(inner: string): CheckoutSlug[] {
  return inner
    .split(',')
    .map(raw => raw.trim())
    .filter(Boolean)
    .map(raw => {
      const required = raw.endsWith('*')
      return { slug: (required ? raw.slice(0, -1) : raw).trim().toLowerCase(), required }
    })
    .filter(s => /^[a-z0-9-]+$/.test(s.slug))
}

/**
 * Semua slug yang ditanda wajib merentas SETIAP tag checkout dalam satu LP.
 * Dipakai pelayan, yang hanya ada `html_content` mentah.
 */
export function requiredSlugsFromHtml(html: string | null | undefined): string[] {
  if (!html) return []
  const out = new Set<string>()
  for (const m of html.matchAll(/\{\{checkout:([^}]*)\}\}/g)) {
    for (const s of parseCheckoutSlugs(m[1] ?? '')) {
      if (s.required) out.add(s.slug)
    }
  }
  return [...out]
}
