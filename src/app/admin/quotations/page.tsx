import { QuotationsClient } from './quotations-client'

export const dynamic = 'force-dynamic'

// Sebut Harga — senarai (jadual) → penuh (AGENTS.md).
export default function QuotationsPage() {
  return (
    <div className="p-4 md:p-6">
      <QuotationsClient />
    </div>
  )
}
