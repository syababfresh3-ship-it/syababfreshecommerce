import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { KURMA_ORIGIN } from '@/lib/kurma-host'

// Layout LP kurma — hanya tetapkan metadataBase ke subdomain (bila aktif) supaya og:image/canonical
// resolve ke kurma.<domain>. Tiada shell/markup; setiap page bawa header/footer sendiri.
export const metadata: Metadata = KURMA_ORIGIN ? { metadataBase: new URL(KURMA_ORIGIN) } : {}

export default function KurmaLayout({ children }: { children: ReactNode }) {
  return children
}
