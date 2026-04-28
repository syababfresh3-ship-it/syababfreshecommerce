export type Segment = 'vip' | 'active' | 'new' | 'at_risk' | 'inactive' | 'no_orders'

export const SEGMENT_CONFIG: Record<Segment, {
  label: string
  color: string       // tailwind classes
  emoji: string
  description: string
}> = {
  vip:       { label: 'VIP',          color: 'bg-yellow-100 text-yellow-700 border-yellow-300', emoji: '👑', description: 'Jumlah belanja ≥ RM500' },
  active:    { label: 'Aktif',        color: 'bg-green-100 text-green-700 border-green-200',    emoji: '✅', description: 'Order dalam 30 hari lepas' },
  new:       { label: 'Baru',         color: 'bg-blue-100 text-blue-700 border-blue-200',       emoji: '🆕', description: 'Daftar dalam 30 hari lepas' },
  at_risk:   { label: 'At Risk',      color: 'bg-orange-100 text-orange-700 border-orange-200', emoji: '⚠️', description: 'Tiada order 30–60 hari' },
  inactive:  { label: 'Tidak Aktif',  color: 'bg-red-100 text-red-600 border-red-200',          emoji: '😴', description: 'Tiada order lebih 60 hari' },
  no_orders: { label: 'Belum Order',  color: 'bg-gray-100 text-gray-500 border-gray-200',       emoji: '💤', description: 'Belum pernah buat pesanan' },
}

export function getSegment({ totalSpend, createdAt, lastOrderAt, orderCount }: {
  totalSpend: number
  createdAt: string
  lastOrderAt: string | null
  orderCount: number
}): Segment {
  const now = Date.now()
  const daysSinceCreated    = (now - new Date(createdAt).getTime()) / 86_400_000
  const daysSinceLastOrder  = lastOrderAt ? (now - new Date(lastOrderAt).getTime()) / 86_400_000 : null

  if (orderCount === 0) return daysSinceCreated <= 30 ? 'new' : 'no_orders'
  if (totalSpend >= 500) return 'vip'
  if (daysSinceLastOrder !== null && daysSinceLastOrder > 60) return 'inactive'
  if (daysSinceLastOrder !== null && daysSinceLastOrder > 30) return 'at_risk'
  if (daysSinceCreated <= 30) return 'new'
  return 'active'
}
