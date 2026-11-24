import type { Metadata } from 'next'
import { OfficeClient } from './office-client'

// Pejabat AI — papan status staf AI (chatbot, routine, agen Hermes, Claude Code), barisan pelanggan,
// kelulusan tertunggak, tugasan berjadual & talian WhatsApp. Laluan tersembunyi (tiada butang sidebar,
// pemilik 25 Nov 2026) — buka terus /admin/pejabat. Data: GET /api/admin/office, segar setiap 15 saat.
export const metadata: Metadata = { title: 'AI Office' }

export default function PejabatPage() {
  return (
    <div className="p-4 md:p-6">
      <OfficeClient />
    </div>
  )
}
