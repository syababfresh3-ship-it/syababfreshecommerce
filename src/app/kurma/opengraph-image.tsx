import { kurmaOg } from '@/lib/kurma-og'
import { GIFT_VARIANTS } from '@/lib/gift-copy'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  const c = GIFT_VARIANTS.default
  return kurmaOg(`${c.headlineBefore}${c.headlineHighlight}${c.headlineAfter ?? ''}`, c.sub)
}
