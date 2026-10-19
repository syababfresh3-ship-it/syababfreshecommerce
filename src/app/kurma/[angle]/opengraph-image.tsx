import { kurmaOg, asJpeg } from '@/lib/kurma-og'
import { GIFT_VARIANTS, GIFT_ANGLES } from '@/lib/gift-copy'
import { heroRenderDataUrl } from '@/lib/kurma-og-photo'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/jpeg'

export function generateStaticParams() {
  return GIFT_ANGLES.map(angle => ({ angle }))
}

export default async function Image({ params }: { params: Promise<{ angle: string }> }) {
  const { angle } = await params
  const c = GIFT_VARIANTS[angle] ?? GIFT_VARIANTS.default
  // Foto = render koleksi (sama dgn /kurma); gagal baca → teks sahaja seperti dulu.
  return asJpeg(kurmaOg(`${c.headlineBefore}${c.headlineHighlight}${c.headlineAfter ?? ''}`, c.sub, undefined, { photo: await heroRenderDataUrl() }))
}
