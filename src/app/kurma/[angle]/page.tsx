import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GiftLanding } from '@/components/kurma/gift-landing'
import { GIFT_VARIANTS, GIFT_ANGLES } from '@/lib/gift-copy'
import { kurmaPath } from '@/lib/kurma-host'

export function generateStaticParams() {
  return GIFT_ANGLES.map(angle => ({ angle }))
}

export async function generateMetadata({ params }: { params: Promise<{ angle: string }> }): Promise<Metadata> {
  const { angle } = await params
  const copy = GIFT_VARIANTS[angle]
  if (!copy || angle === 'default') return {}
  return {
    // absolute: metaTitle sudah ada "| SyababFresh" — elak template root tambah sekali lagi (pendua)
    title: { absolute: copy.metaTitle },
    description: copy.metaDesc,
    alternates: { canonical: kurmaPath(`/${angle}`) },
    openGraph: { title: copy.metaTitle, description: copy.metaDesc, type: 'website', url: kurmaPath(`/${angle}`) },
    twitter: { card: 'summary_large_image', title: copy.metaTitle, description: copy.metaDesc },
  }
}

export default async function GiftAngleLanding({ params }: { params: Promise<{ angle: string }> }) {
  const { angle } = await params
  const copy = GIFT_VARIANTS[angle]
  if (!copy || angle === 'default') notFound()
  return <GiftLanding copy={copy} />
}
