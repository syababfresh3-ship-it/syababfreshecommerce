import { CostsClient } from './costs-client'
import { SheetCostsClient } from './sheet-costs-client'

// Kos & Harga (Gift Studio). Sumber utama (25 Okt 2026): Google Sheet "GIFT BOX CUSTOM 2026" — team sale
// ubah di Sheet, tarik di sini, main margin dengan kalkulator. Jadual kos manual lama dilipat (hanya
// dipakai panel sebut harga order Studio lama di Enquiry Gift; tak perlu jika Sheet digunakan).
export const dynamic = 'force-dynamic'

export default function GiftCostsPage() {
  return (
    // Borang → max-w-4xl (AGENTS.md)
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gift Studio — Kos &amp; Harga</h1>
        <p className="text-sm text-gray-500 mt-0.5">Sumber harga & kos: Google Sheet <b>GIFT BOX CUSTOM 2026</b>. Ubah di Sheet, tekan Tarik dari Sheet. Kalkulator di bawah (dan dalam sebut harga) untuk main margin tanpa buka Sheet.</p>
      </div>
      <SheetCostsClient />
      <details className="rounded-2xl border border-gray-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900">Tetapan kos manual (lama) — tak perlu diisi jika Sheet digunakan</summary>
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-500 mt-3 mb-3">Hanya dipakai panel &quot;Harga anda vs kos&quot; pada order Studio lama di Enquiry Gift. Pipeline & sebut harga guna Sheet di atas.</p>
          <CostsClient />
        </div>
      </details>
    </div>
  )
}
