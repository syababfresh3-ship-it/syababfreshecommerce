import { GiftOrderDetail } from './order-detail-client'

export const dynamic = 'force-dynamic'

// Gift order detail — form/detail → berhad (AGENTS.md: max-w-4xl).
export default async function GiftOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <GiftOrderDetail id={id} />
    </div>
  )
}
