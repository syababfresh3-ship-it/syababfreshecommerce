import { BorongSettingsClient } from './borong-client'

// Harga Borong — tetapan harga rujukan & terma LP /kurma/borong (app_settings.borong_pricing).
export const dynamic = 'force-dynamic'

export default function BorongSettingsPage() {
  return (
    // Penuh (AGENTS.md): page ini ada jadual sheet wholesale (SKU · kos · 3 tier · dropdown · 2 butang) + jadual harga
    // per karton — pada max-w-4xl butang aksi terpotong (pemilik 11 Nov 2026: "terlalu sempit, buat full page")
    <div className="p-4 md:p-6">
      <BorongSettingsClient />
    </div>
  )
}
