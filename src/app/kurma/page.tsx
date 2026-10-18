import type { Metadata } from 'next'
import { GiftLanding } from '@/components/kurma/gift-landing'
import { GIFT_VARIANTS } from '@/lib/gift-copy'
import { kurmaPath } from '@/lib/kurma-host'

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
  return <GiftLanding copy={copy} />
}
