import type { Metadata } from 'next'
import { PosSettingsClient } from './settings-client'

export const metadata: Metadata = { title: 'POS Settings' }

// Borang tetapan → max-w-4xl (AGENTS.md)
export default function AdminPosSettingsPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <PosSettingsClient />
    </div>
  )
}
