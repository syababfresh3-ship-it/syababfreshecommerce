import type { Metadata } from 'next'
import { SalesClient } from '@/components/pos/sales/sales-client'

export const metadata: Metadata = { title: 'Sales' }

export default function PosSalesPage() {
  return <SalesClient />
}
