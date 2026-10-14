import type { Metadata } from 'next'
import { GiftLanding } from '@/components/kurma/gift-landing'
import { GIFT_VARIANTS } from '@/lib/gift-copy'

const copy = GIFT_VARIANTS.default

export const metadata: Metadata = {
  // absolute: metaTitle sudah ada "| SyababFresh" — elak template root tambah sekali lagi (pendua)
  title: { absolute: copy.metaTitle },
  description: copy.metaDesc,
  openGraph: { title: copy.metaTitle, description: copy.metaDesc, type: 'website' },
  twitter: { card: 'summary_large_image', title: copy.metaTitle, description: copy.metaDesc },
}

export default function KurmaLandingPage() {
  return <GiftLanding copy={copy} />
}
