import { QuotationEditor } from '../quotation-editor'

export const dynamic = 'force-dynamic'

// Sebut harga baharu. ?gift=<gift_orders.id> → pra-isi.
// Penuh (pengecualian AGENTS.md, pemilik 24 Okt 2026): editor baris item berlajur lebar, sama seperti Products new/edit.
export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<{ gift?: string }> }) {
  const { gift } = await searchParams
  return (
    <div className="p-4 md:p-6">
      <QuotationEditor giftOrderId={gift ?? null} />
    </div>
  )
}
