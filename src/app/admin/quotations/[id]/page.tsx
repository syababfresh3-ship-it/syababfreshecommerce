import { QuotationEditor } from '../quotation-editor'

export const dynamic = 'force-dynamic'

// Butiran / edit sebut harga.
// Penuh (pengecualian AGENTS.md, pemilik 24 Okt 2026): editor baris item berlajur lebar, sama seperti Products new/edit.
export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="p-4 md:p-6">
      <QuotationEditor id={id} />
    </div>
  )
}
