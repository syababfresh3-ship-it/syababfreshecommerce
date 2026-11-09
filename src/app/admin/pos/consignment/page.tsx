import type { Metadata } from 'next'
import { PosConsignmentClient } from './consignment-client'

export const metadata: Metadata = { title: 'POS Consignment' }

// Pembekal + jadual jualan/penyata/stok → lebar penuh (AGENTS.md)
export default function AdminPosConsignmentPage() {
  return (
    <div className="p-4 md:p-6">
      <PosConsignmentClient />
    </div>
  )
}
