import { kurmaOg } from '@/lib/kurma-og'
import { HERO } from '@/lib/borong-copy'
import { BORONG_CATALOG } from '@/lib/borong-pricing'
import { getBorongProducts } from '@/lib/borong-data'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// OG LP borong: teks + foto produk `featured` pertama (PNG/JPEG DB → normalise & kecilkan dgn sharp → JPEG
// data URL supaya Satori tak fetch luar). Apa-apa gagal → teks sahaja.
export default async function Image() {
  let dataUrl: string | undefined
  try {
    const featured = BORONG_CATALOG.filter(e => e.featured).map(e => e.slug)
    const products = await getBorongProducts(featured)
    const url = featured.map(s => products.get(s)?.image_url).find((u): u is string => !!u)
    if (url) {
      const res = await fetch(url, { cache: 'force-cache' })
      if (res.ok) {
        const sharp = (await import('sharp')).default
        const jpg = await sharp(Buffer.from(await res.arrayBuffer())).resize(440, 440, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer()
        dataUrl = `data:image/jpeg;base64,${jpg.toString('base64')}`
      }
    }
  } catch { dataUrl = undefined }
  return kurmaOg(`${HERO.headlineBefore}${HERO.headlineHighlight}`, HERO.sub, dataUrl, { kicker: 'Kurma Borong', footer: 'Karton 3–5kg · Kedai · Bazar · Ejen · Masjid · WhatsApp 011-5640 3601' })
}
