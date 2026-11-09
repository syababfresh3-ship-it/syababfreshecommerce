import type { Metadata } from 'next'
import { SellClient } from '@/components/pos/sell/sell-client'

export const metadata: Metadata = { title: 'Sell' }

export default function PosSellPage() {
  return <SellClient />
}
