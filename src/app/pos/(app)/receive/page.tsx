import type { Metadata } from 'next'
import { ReceiveClient } from '@/components/pos/receive/receive-client'

export const metadata: Metadata = { title: 'Receive' }

export default function PosReceivePage() {
  return <ReceiveClient />
}
