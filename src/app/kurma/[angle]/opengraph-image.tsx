import { kurmaOg } from '@/lib/kurma-og'
import { GIFT_VARIANTS, GIFT_ANGLES } from '@/lib/gift-copy'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export function generateStaticParams() {
  return GIFT_ANGLES.map(angle => ({ angle }))
}

export default async function Image({ params }: { params: Promise<{ angle: string }> }) {
  const { angle } = await params
  const c = GIFT_VARIANTS[angle] ?? GIFT_VARIANTS.default
  return kurmaOg(`${c.headlineBefore}${c.headlineHighlight}${c.headlineAfter ?? ''}`, c.sub)
}
