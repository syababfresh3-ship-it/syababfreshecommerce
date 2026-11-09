import type { Metadata } from 'next'
import { PosOutletsClient } from './outlets-client'

export const metadata: Metadata = { title: 'POS Outlets' }

// Kad outlet + jadual stok & lejar → lebar penuh (AGENTS.md)
export default function AdminPosOutletsPage() {
  return (
    <div className="p-4 md:p-6">
      <PosOutletsClient />
    </div>
  )
}
