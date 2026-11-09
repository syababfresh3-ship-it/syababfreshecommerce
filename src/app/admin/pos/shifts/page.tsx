import type { Metadata } from 'next'
import { PosShiftsAdminClient } from './shifts-admin-client'

export const metadata: Metadata = { title: 'POS Shifts' }

// Jadual shift (buka/tutup kedai, tunai dijangka vs dikira) → lebar penuh (AGENTS.md)
export default function AdminPosShiftsPage() {
  return (
    <div className="p-4 md:p-6">
      <PosShiftsAdminClient />
    </div>
  )
}
