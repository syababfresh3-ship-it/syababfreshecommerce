// Custom Next.js image loader — resize & optimize imej melalui Supabase Storage
// image transformation, bukan Vercel Image Optimization. Ini memindahkan kerja
// optimize ke CDN Supabase (jimat kuota Image Optimization + Edge Requests Vercel).
//
// Imej Supabase Storage public → ditukar ke endpoint /render/image/ + width/quality.
// Browser yang sokong WebP auto dapat WebP (Supabase negotiate ikut header Accept).
// Imej lokal (cth logo dari /public) dibiarkan apa adanya.

const OBJECT_MARKER = '/storage/v1/object/public/'
const RENDER_PATH = '/storage/v1/render/image/public/'
const MAX_WIDTH = 1920 // had lebar transform Supabase yang selamat

export default function supabaseImageLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  if (!src.includes(OBJECT_MARKER)) return src
  const base = src.split('?')[0].replace(OBJECT_MARKER, RENDER_PATH)
  const w = Math.min(width, MAX_WIDTH)
  // 62 = jimat ~bytes (PSI "improve image delivery") tapi masih tajam untuk foto produk
  const q = quality ?? 62
  return `${base}?width=${w}&quality=${q}`
}
