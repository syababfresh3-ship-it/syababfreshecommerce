import { InvoicesClient } from './invoices-client'

export const dynamic = 'force-dynamic'

// Invois Refrens — senarai (jadual) → penuh (AGENTS.md). Baca sahaja dari API Refrens.
export default function RefrensInvoicesPage() {
  return (
    <div className="p-4 md:p-6">
      <InvoicesClient />
    </div>
  )
}
