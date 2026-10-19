import { kurmaOg, asJpeg } from '@/lib/kurma-og'
import { HERO } from '@/lib/korporat-copy'
import { featuredCases, photoAt } from '@/lib/gift-clients'
import { thumbUrl } from '@/lib/gift'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/jpeg'

// OG LP korporat: teks + foto kotak klien pertama (BPMB). Foto diambil sebagai bait → data URL
// (Satori tak fetch luar). Satori TAK sokong WebP (foto kita semua .webp) → tukar ke JPEG dgn `sharp`
// (dependency Next, ada di node_modules). Apa-apa gagal → fallback teks sahaja (kurmaOg tanpa arg ke-3).
export default async function Image() {
  let dataUrl: string | undefined
  try {
    const hero = featuredCases()[0]
    const res = await fetch(thumbUrl(photoAt(hero.heroIndex)), { cache: 'force-cache' })
    if (res.ok) {
      const sharp = (await import('sharp')).default
      const jpg = await sharp(Buffer.from(await res.arrayBuffer())).jpeg({ quality: 82 }).toBuffer()
      dataUrl = `data:image/jpeg;base64,${jpg.toString('base64')}`
    }
  } catch { dataUrl = undefined }
  // JPEG: PNG berfoto 375KB melebihi had thumbnail WhatsApp (~300KB)
  return asJpeg(kurmaOg(`${HERO.headlineBefore}${HERO.headlineHighlight}`, HERO.sub, dataUrl))
}
