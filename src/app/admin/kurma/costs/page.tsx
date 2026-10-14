import { CostsClient } from './costs-client'

// Kos & Harga (Gift Studio) — tetapan kos untuk quote tool (app_settings.gift_cost_config).
export const dynamic = 'force-dynamic'

export default function GiftCostsPage() {
  return (
    // Borang → max-w-4xl (AGENTS.md)
    <div className="p-4 md:p-6 max-w-4xl">
      <CostsClient />
    </div>
  )
}
