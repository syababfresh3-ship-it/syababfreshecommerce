import { AdsClient } from './ads-client'

export const dynamic = 'force-dynamic'

// Ad Spend & ROAS — senarai + borang ringkas → lebar penuh (AGENTS.md)
export default function AdSpendPage() {
  return (
    <div className="p-4 md:p-6">
      <AdsClient />
    </div>
  )
}
