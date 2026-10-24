import { InvoiceForm } from '../invoice-form'

export const dynamic = 'force-dynamic'

// Cipta invois terus di Refrens (tanpa sebut harga). Penuh (pengecualian AGENTS.md, sama seperti editor sebut harga).
export default function NewRefrensInvoicePage() {
  return (
    <div className="p-4 md:p-6">
      <InvoiceForm />
    </div>
  )
}
