import type { Metadata } from 'next'
import { GiftLanding } from '@/components/kurma/gift-landing'
import { GIFT_VARIANTS } from '@/lib/gift-copy'
import { kurmaAbs, kurmaPath } from '@/lib/kurma-host'
import { JsonLd, breadcrumbSchema, serviceSchema } from '@/components/seo/json-ld'
import { sheetPriceRange } from '@/lib/gift-pricing'

const copy = GIFT_VARIANTS.default

export const metadata: Metadata = {
  // absolute: metaTitle sudah ada "| SyababFresh" — elak template root tambah sekali lagi (pendua)
  title: { absolute: copy.metaTitle },
  description: copy.metaDesc,
  alternates: { canonical: kurmaPath('/') },
  openGraph: { title: copy.metaTitle, description: copy.metaDesc, type: 'website', url: kurmaPath('/') },
  twitter: { card: 'summary_large_image', title: copy.metaTitle, description: copy.metaDesc },
}

export default function KurmaLandingPage() {
  // JSON-LD page utama funnel: BreadcrumbList + Service (FAQPage sudah di dalam GiftLanding).
  // URL absolute ikut hos berkesan (kurmaAbs → subdomain bila aktif); julat harga dari sheet gift-pricing.
  const url = kurmaAbs('/')
  const harga = sheetPriceRange()
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'SyababFresh', path: '/' }, { name: 'Gift Box Kurma', url }])} />
      <JsonLd
        data={serviceSchema({
          name: 'Gift Box Kurma Custom',
          serviceType: 'Gift box kurma custom berjenama untuk korporat, agensi & individu',
          description: copy.sub,
          url,
          areaServed: 'Malaysia',
          offers: {
            lowPrice: harga.low,
            highPrice: harga.high,
            minQty: harga.minQty,
            unitText: 'kotak',
            note: 'Harga sekotak termasuk kurma & kotak custom, tanpa penghantaran. Lebih banyak kuantiti, lebih murah seunit.',
          },
        })}
      />
      <GiftLanding copy={copy} />
    </>
  )
}
