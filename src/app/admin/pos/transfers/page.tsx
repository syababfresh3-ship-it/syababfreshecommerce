import type { Metadata } from 'next'
import { PosTransfersClient } from './transfers-client'

export const metadata: Metadata = { title: 'POS Delivery Orders' }

// Senarai DO + borang baharu dengan jadual baris → lebar penuh (AGENTS.md)
export default function AdminPosTransfersPage() {
  return (
    <div className="p-4 md:p-6">
      <PosTransfersClient />
    </div>
  )
}
