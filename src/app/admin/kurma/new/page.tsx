import { NewGiftOrderClient } from './new-order-client'

export const dynamic = 'force-dynamic'

// Manual gift order key-in — form → berhad (AGENTS.md).
export default function NewGiftOrderPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <NewGiftOrderClient />
    </div>
  )
}
