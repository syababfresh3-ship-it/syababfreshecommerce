import type { Metadata } from 'next'
import { PosSalesAdminClient } from './sales-admin-client'

export const metadata: Metadata = { title: 'POS Sales' }

// Senarai jualan POS → lebar penuh (AGENTS.md)
export default function AdminPosSalesPage() {
  return (
    <div className="p-4 md:p-6">
      <PosSalesAdminClient />
    </div>
  )
}
