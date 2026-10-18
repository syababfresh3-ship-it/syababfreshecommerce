import type { Metadata } from 'next'
import { GiftStudio } from '@/components/kurma/studio/gift-studio'
import { kurmaPath } from '@/lib/kurma-host'

// /kurma/studio — page HOT LEAD (pautan dihantar sales selepas lead berminat), bukan LP iklan:
// tawaran → pilih template + letak logo (preview 2D) → calculator → enquiry disimpan ke admin
// (gift_orders 'enquiry') → terus WhatsApp dgn no. rujukan. noindex: bukan untuk carian.
export const metadata: Metadata = {
  title: { absolute: 'Studio Gift Box Kurma — Reka & Sebut Harga | SyababFresh' },
  description: 'Pilih template, letak logo anda, kira harga dan hantar enquiry gift box kurma custom — terus ke WhatsApp.',
  robots: { index: false, follow: false },
  alternates: { canonical: kurmaPath('/studio') },
}

export default function StudioPage() {
  return <GiftStudio />
}
