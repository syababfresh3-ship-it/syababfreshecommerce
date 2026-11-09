import type { Metadata } from 'next'
import { PosCashiersClient } from './cashiers-client'

export const metadata: Metadata = { title: 'POS Cashiers & Access' }

// Borang/tetapan → max-w-4xl (AGENTS.md)
export default function AdminPosCashiersPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <PosCashiersClient />
    </div>
  )
}
