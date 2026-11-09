import type { Metadata } from 'next'
import { PosDashboardClient } from './dashboard-client'

export const metadata: Metadata = { title: 'POS' }

// Dashboard POS (senarai/kad → lebar penuh ikut AGENTS.md)
export default function AdminPosPage() {
  return (
    <div className="p-4 md:p-6">
      <PosDashboardClient />
    </div>
  )
}
