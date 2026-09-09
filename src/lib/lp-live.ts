// ============================================================
// Template LP "live" — susun atur gaya TikTok, kandungan SEBENAR.
//
// Prinsip (keputusan pemilik, 2026-09): tiada badge LIVE pada rakaman,
// tiada kiraan penonton/like rekaan, tiada butang Follow palsu, tiada
// komen berskrip. Komen bergerak = ulasan pelanggan sebenar
// (product_reviews). Bayaran & order = flow LP sedia ada (CHIP/COD).
// ============================================================

export type LpTemplate = 'classic' | 'live'

export interface LpLiveConfig {
  video_url: string            // MP4 menegak disyorkan; YouTube/TikTok disokong (paparan tak penuh)
  poster_url: string           // gambar sebelum video main (pilihan)
  products: string[]           // slug produk, susunan = urutan dalam beg
  pinned_product: string       // slug produk pada kad bawah (default: produk pertama)
  host_name: string
  host_tagline: string         // baris kecil bawah nama (pilihan, kosong = tiada)
  host_avatar_url: string      // kosong → logo kedai (app_settings.store_logo_url)
  pinned_note: string          // kotak nota tersemat (jujur: "video promosi, bukan siaran langsung")
  show_reviews: boolean        // komen bergerak dari ulasan sebenar
  reviews_scope: 'products' | 'all'   // ulasan produk dipilih sahaja / semua produk kedai
  reviews_visible: number      // 1–4 gelembung serentak (1 = tak ganggu video)
  allow_comments: boolean      // borang komen penonton (disimpan 'pending', papar selepas admin lulus)
  buy_label: string
  autoplay: boolean            // auto main (senyap) — pelanggan tekan untuk buka suara
  wa_prefill: string           // teks awal butang "Tanya" (WhatsApp CS)
  wa_number: string            // nombor WA butang Tanya, digit sahaja cth 601156816548 (kosong = CS lalai)
}

export const DEFAULT_LIVE_CONFIG: LpLiveConfig = {
  video_url: '',
  poster_url: '',
  products: [],
  pinned_product: '',
  host_name: 'SyababFresh',
  host_tagline: '',
  host_avatar_url: '',
  pinned_note: 'Video promosi (bukan siaran langsung). Tekan produk di bawah untuk pesan. Bayar FPX, e-wallet atau COD.',
  show_reviews: true,
  reviews_scope: 'products',
  reviews_visible: 1,
  allow_comments: true,
  buy_label: 'Beli Sekarang',
  autoplay: true,
  wa_prefill: '',
  wa_number: '',
}

const SLUG_RE = /^[a-z0-9-]+$/
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Bersihkan input admin → bentuk selamat untuk simpan & render. Tak pernah throw.
export function normalizeLiveConfig(input: unknown): LpLiveConfig {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const products = Array.isArray(o.products)
    ? [...new Set(o.products.map(p => str(p, 100).toLowerCase()).filter(p => SLUG_RE.test(p)))].slice(0, 12)
    : []
  const pinned = str(o.pinned_product, 100).toLowerCase()
  return {
    video_url: str(o.video_url, 1000),
    poster_url: str(o.poster_url, 1000),
    products,
    pinned_product: products.includes(pinned) ? pinned : (products[0] ?? ''),
    host_name: str(o.host_name, 60) || DEFAULT_LIVE_CONFIG.host_name,
    host_tagline: str(o.host_tagline, 60),
    host_avatar_url: str(o.host_avatar_url, 1000),
    pinned_note: str(o.pinned_note, 200),
    show_reviews: o.show_reviews !== false,
    reviews_scope: o.reviews_scope === 'all' ? 'all' : 'products',
    reviews_visible: [1, 2, 3, 4].includes(Number(o.reviews_visible)) ? Number(o.reviews_visible) : 1,
    allow_comments: o.allow_comments !== false,
    buy_label: str(o.buy_label, 30) || DEFAULT_LIVE_CONFIG.buy_label,
    autoplay: o.autoplay !== false,
    wa_prefill: str(o.wa_prefill, 200),
    wa_number: normalizeWaNumber(o.wa_number),
  }
}

// "+60 11-5681 6548" / "0115681 6548" → "601156816548"; tak sah → ''
export function normalizeWaNumber(v: unknown): string {
  let d = (typeof v === 'string' ? v : '').replace(/\D/g, '')
  if (d.startsWith('0')) d = '60' + d.slice(1)
  return /^\d{10,15}$/.test(d) ? d : ''
}

// Mesej ralat (BM) atau null kalau sah. Dipanggil di API (POST/PATCH) dan borang admin.
export function validateLiveConfig(c: LpLiveConfig): string | null {
  if (!c.video_url) return 'URL video diperlukan untuk template Live'
  if (!/^https?:\/\//i.test(c.video_url)) return 'URL video mesti bermula dengan https://'
  if (c.products.length === 0) return 'Pilih sekurang-kurangnya satu produk untuk template Live'
  return null
}

// "Nurul Aina Binti X" → "Nurul A." — nama sebenar tapi tak dedah penuh
export function shortReviewerName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Pelanggan'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`
}
