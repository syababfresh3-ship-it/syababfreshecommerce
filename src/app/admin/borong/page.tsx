import { BorongSettingsClient } from './borong-client'

// Harga Borong — tetapan harga rujukan & terma LP /kurma/borong (app_settings.borong_pricing).
export const dynamic = 'force-dynamic'

export default function BorongSettingsPage() {
  return (
    // Borang → max-w-4xl (AGENTS.md)
    <div className="p-4 md:p-6 max-w-4xl">
      <BorongSettingsClient />
    </div>
  )
}
