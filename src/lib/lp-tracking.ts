// ============================================================
// Tracking Meta Pixel khusus Landing Page (LP) — ADDITIVE atas lib/tracking.ts.
//
// Keputusan pemilik (Anas, 22 Okt 2026): LP sebelum ini hanya fire PageView,
// Lead dan Purchase. AddToCart & InitiateCheckout tiada langsung, dan Purchase
// pelayar tiada eventID → tak dedup dengan CAPI (event_id = purchase_<no order>).
//
// Pixel yang dipakai = fbq global yang dimuat oleh lp-pixels.tsx (page.meta_pixel_id).
// Semua fungsi selamat dipanggil di server (no-op) dan bila fbq belum dimuat (no-op
// dalam lib/tracking.ts). Kedai biasa tak disentuh.
// ============================================================
import { trackAddToCart, trackInitiateCheckout } from '@/lib/tracking'

// Penanda "dah fire" dalam memori — fallback bila sessionStorage tak tersedia
// (mod privat / storage disekat).
const sudah = new Set<string>()

// true = kali pertama untuk kunci ini dalam sesi pelayar; false = dah pernah.
function sekaliSahaja(key: string): boolean {
  if (sudah.has(key)) return false
  try {
    if (window.sessionStorage.getItem(key)) { sudah.add(key); return false }
  } catch { /* storage disekat → bergantung pada Set sahaja */ }
  sudah.add(key)
  try { window.sessionStorage.setItem(key, '1') } catch { /* abaikan */ }
  return true
}

// AddToCart — dipanggil dari store lp-cart bila item ditambah (meliputi butang
// LpAddToCartBtn, template Live dan Video sekali gus).
export function lpTrackAddToCart(item: { productName: string; variantName?: string | null; unitPrice: number; qty: number }) {
  if (typeof window === 'undefined') return
  const name = item.variantName ? `${item.productName} · ${item.variantName}` : item.productName
  trackAddToCart(name, Number(item.unitPrice) || 0, Number(item.qty) || 1)
}

// InitiateCheckout — SEKALI sahaja per sesi pelayar per LP (slug), walau borang
// difokus berkali-kali atau ada dua komponen checkout dalam satu page (inline +
// cart bar). Tak fire selagi subtotal 0 (belum pilih produk) supaya kunci sesi tak
// terpakai dengan nilai kosong.
export function lpTrackInitiateCheckout(slug: string, value: number) {
  if (typeof window === 'undefined') return
  const v = Math.round((Number(value) || 0) * 100) / 100
  if (v <= 0) return
  if (!sekaliSahaja(`sf_lp_ic_${slug}`)) return
  trackInitiateCheckout(v)
}

// eventID Purchase — MESTI sama dengan event_id CAPI dalam lib/meta-capi.ts
// (`purchase_${orderNumber}`) supaya Meta dedup pelayar ↔ pelayan.
export function lpPurchaseEventId(orderNumber: string): string {
  return `purchase_${orderNumber}`
}
