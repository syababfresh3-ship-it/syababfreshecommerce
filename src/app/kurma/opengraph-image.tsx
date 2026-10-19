import { kurmaOg, asJpeg } from '@/lib/kurma-og'
import { GIFT_VARIANTS } from '@/lib/gift-copy'
import { heroRenderDataUrl } from '@/lib/kurma-og-photo'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/jpeg'

// Foto = render koleksi gift box (public/kurma/renders) — layout foto; gagal baca → teks sahaja seperti dulu.
export default async function Image() {
  const c = GIFT_VARIANTS.default
  return asJpeg(kurmaOg(`${c.headlineBefore}${c.headlineHighlight}${c.headlineAfter ?? ''}`, c.sub, undefined, { photo: await heroRenderDataUrl() }))
}
