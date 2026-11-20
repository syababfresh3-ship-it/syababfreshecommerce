// ============================================================
// lp-og-image — pilih gambar pratonton pautan (og:image) untuk satu landing page.
// Turutan:
//   1. Override sales dalam HTML LP:  <!-- og-image: https://... -->   (tak kelihatan di page)
//   2. Gambar pertama dalam html_content ikut susunan dokumen (<img src> / <video poster>),
//      langkau logo/ikon/svg/gif/data URI
//   3. Gambar produk pertama dalam {{checkout:...}} (produk wajib '*' didahulukan)
//   4. null → pemanggil guna /og-image.jpg lalai
// Dipakai oleh /api/lp-og/[slug] (render JPEG 1200×630) — tiada migration.
// ============================================================
import { parseCheckoutSlugs } from '@/lib/lp-required'

export interface OgProduct { slug: string; image_url?: string | null; images?: string[] | null }

const SKIP_SRC = /logo|icon|favicon|badge|avatar|pin[-_.]|[-_.]pin|arrow|check|tick|star|emoji|flag|bullet|qr[-_.]|whatsapp|wa-media|\.svg(\?|$)|\.gif(\?|$)/i
const SKIP_TAG = /\b(class|alt)=["'][^"']*(icon|logo|pin|badge|avatar)[^"']*["']/i
const PREFER_SRC = /hero|banner|cover|poster|og[-_.]|utama/i
const tinyTag = (tag: string) => { const w = tag.match(/\bwidth=["']?(\d+)/i); const h = tag.match(/\bheight=["']?(\d+)/i); return (w && Number(w[1]) < 300) || (h && Number(h[1]) < 200) }

export function lpOgOverride(html: string): string | null {
  const m = html.match(/<!--\s*og-image:\s*(https?:\/\/[^\s>]+)\s*-->/i)
  return m ? m[1] : null
}

/** Slug produk ikut susunan {{checkout:...}} pertama (tanpa tanda '*'). */
export function lpFirstCheckoutSlugs(html: string): string[] {
  const m = html.match(/\{\{checkout:([a-zA-Z0-9,\-*\s]+)\}\}/)
  if (!m) return []
  return parseCheckoutSlugs(m[1]).map((s) => s.slug)
}

export function lpHtmlImageCandidates(html: string): string[] {
  const found: { at: number; src: string }[] = []
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1]
    if (!src || SKIP_TAG.test(tag) || tinyTag(tag)) continue
    found.push({ at: m.index ?? 0, src })
  }
  for (const m of html.matchAll(/<video\b[^>]*?\sposter=["']([^"']+)["']/gi)) found.push({ at: m.index ?? 0, src: m[1] })
  const list = found
    .sort((a, b) => a.at - b.at)
    .map((f) => f.src.trim())
    .filter((src) => /^https?:\/\//i.test(src) && !SKIP_SRC.test(src))
  // Gambar bernama hero/banner/cover didahulukan walau bukan yang pertama dalam dokumen.
  const preferred = list.filter((src) => PREFER_SRC.test(src))
  return [...preferred, ...list.filter((src) => !PREFER_SRC.test(src))]
}

export function pickLpOgImage(html: string, products: OgProduct[]): string | null {
  const override = lpOgOverride(html)
  if (override) return override
  const fromHtml = lpHtmlImageCandidates(html)[0]
  if (fromHtml) return fromHtml
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  for (const slug of lpFirstCheckoutSlugs(html)) {
    const p = bySlug.get(slug)
    const img = p?.image_url || p?.images?.[0]
    if (img) return img
  }
  const any = products.find((p) => p.image_url || p.images?.[0])
  return any ? (any.image_url || any.images?.[0] || null) : null
}
