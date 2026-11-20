// ============================================================
// api/lp-og/[slug] — gambar pratonton pautan (og:image) untuk landing page.
// Pilih gambar LP (lib/lp-og-image), muat turun, potong 1200×630 (cover), keluarkan JPEG
// (WhatsApp/Threads/Facebook tak papar WebP sebagai og:image). Tiada gambar / gagal →
// redirect ke /og-image.jpg lalai. Cache CDN sehari; LP diubah → gambar baru ikut dalam sehari
// (scraper Meta pun cache sendiri — guna Facebook Sharing Debugger untuk paksa segar).
// ============================================================
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { pickLpOgImage, lpFirstCheckoutSlugs } from '@/lib/lp-og-image'

const FALLBACK = '/og-image.jpg'

// Gambar lebar → potong cover 1200×630. Gambar tinggi/segi empat (poster 4:5, foto produk 1:1) → papar PENUH
// di tengah atas latar kabur gambar yang sama, supaya tajuk/harga poster tak terpotong.
export async function renderOg(buf: Buffer): Promise<Buffer> {
  const src = sharp(buf).rotate()
  const meta = await src.metadata()
  const ratio = (meta.width ?? 1) / (meta.height ?? 1)
  if (ratio >= 1.5) {
    return src.resize(1200, 630, { fit: 'cover', position: 'attention' }).flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  }
  const [bg, fg] = await Promise.all([
    sharp(buf).rotate().resize(1200, 630, { fit: 'cover' }).blur(28).modulate({ brightness: 0.72, saturation: 1.1 }).toBuffer(),
    sharp(buf).rotate().resize(1200, 630, { fit: 'inside' }).toBuffer(),
  ])
  const fgMeta = await sharp(fg).metadata()
  return sharp(bg)
    .composite([{ input: fg, left: Math.round((1200 - (fgMeta.width ?? 0)) / 2), top: Math.round((630 - (fgMeta.height ?? 0)) / 2) }])
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
}
const MAX_BYTES = 12 * 1024 * 1024

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const fallback = () => NextResponse.redirect(new URL(FALLBACK, req.url), 307)
  if (!/^[a-zA-Z0-9-]+$/.test(slug)) return fallback()

  try {
    const sb = createAdminClient()
    const { data: page } = await sb.from('landing_pages').select('html_content').eq('slug', slug).eq('is_active', true).maybeSingle()
    if (!page?.html_content) return fallback()
    const html = page.html_content as string

    // Produk hanya perlu bila HTML tiada gambar sesuai — tapi murah untuk ambil 6 pertama.
    const slugs = lpFirstCheckoutSlugs(html).slice(0, 6)
    const { data: products } = slugs.length
      ? await sb.from('products').select('slug, image_url, images').in('slug', slugs)
      : { data: [] as { slug: string; image_url: string | null; images: string[] | null }[] }
    const ordered = slugs.map((s) => (products ?? []).find((p) => p.slug === s)).filter(Boolean) as { slug: string; image_url: string | null; images: string[] | null }[]

    const src = pickLpOgImage(html, ordered)
    if (!src) return fallback()

    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 8000)
    let buf: Buffer
    try {
      const res = await fetch(src, { signal: ctl.signal, cache: 'no-store' })
      if (!res.ok) return fallback()
      if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) return fallback()
      buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > MAX_BYTES) return fallback()
    } finally {
      clearTimeout(t)
    }

    const out = await renderOg(buf)

    return new NextResponse(new Uint8Array(out), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(out.length),
        'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch (e) {
    console.error('[lp-og]', slug, e)
    return fallback()
  }
}
