import { GiftOrdersClient } from './orders-client'

export const dynamic = 'force-dynamic'

// Gift Studio — orders/enquiries. List → full width (AGENTS.md).
export default function GiftOrdersPage() {
  return (
    <div className="p-4 md:p-6">
      <GiftOrdersClient />
    </div>
  )
}
