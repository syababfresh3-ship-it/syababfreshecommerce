export type Segment = 'vip' | 'active' | 'new' | 'at_risk' | 'inactive' | 'no_orders'
export type Channel = 'both' | 'lp_only' | 'store_only' | 'none'

export const SEGMENT_CONFIG: Record<Segment, {
  label: string
  color: string
  emoji: string
  description: string
}> = {
  vip:       { label: 'VIP',      color: 'bg-yellow-100 text-yellow-700 border-yellow-300', emoji: '👑', description: 'Total spend ≥ RM500' },
  active:    { label: 'Active',   color: 'bg-green-100 text-green-700 border-green-200',    emoji: '✅', description: 'Ordered in last 30 days' },
  new:       { label: 'New',      color: 'bg-blue-100 text-blue-700 border-blue-200',       emoji: '🆕', description: 'Registered within 30 days' },
  at_risk:   { label: 'At Risk',  color: 'bg-orange-100 text-orange-700 border-orange-200', emoji: '⚠️', description: 'No order 30–60 days' },
  inactive:  { label: 'Inactive', color: 'bg-red-100 text-red-600 border-red-200',          emoji: '😴', description: 'No order over 60 days' },
  no_orders: { label: 'No Orders',color: 'bg-gray-100 text-gray-500 border-gray-200',       emoji: '💤', description: 'Never placed an order' },
}

export const CHANNEL_CONFIG: Record<Channel, { label: string; color: string; emoji: string }> = {
  both:        { label: 'Store + LP', color: 'bg-purple-100 text-purple-700 border-purple-200', emoji: '🔀' },
  lp_only:     { label: 'LP Only',    color: 'bg-rose-100 text-rose-700 border-rose-200',       emoji: '📄' },
  store_only:  { label: 'Store Only', color: 'bg-teal-100 text-teal-700 border-teal-200',       emoji: '🛒' },
  none:        { label: 'No Orders',  color: 'bg-gray-100 text-gray-400 border-gray-200',       emoji: '—' },
}

export function getSegment({ totalSpend, createdAt, lastOrderAt, orderCount }: {
  totalSpend: number
  createdAt: string
  lastOrderAt: string | null
  orderCount: number
}): Segment {
  const now = Date.now()
  const daysSinceCreated   = (now - new Date(createdAt).getTime()) / 86_400_000
  const daysSinceLastOrder = lastOrderAt ? (now - new Date(lastOrderAt).getTime()) / 86_400_000 : null

  if (orderCount === 0) return daysSinceCreated <= 30 ? 'new' : 'no_orders'
  if (totalSpend >= 500) return 'vip'
  if (daysSinceLastOrder !== null && daysSinceLastOrder > 60) return 'inactive'
  if (daysSinceLastOrder !== null && daysSinceLastOrder > 30) return 'at_risk'
  if (daysSinceCreated <= 30) return 'new'
  return 'active'
}

export function getChannel(storeOrderCount: number, lpOrderCount: number): Channel {
  if (storeOrderCount > 0 && lpOrderCount > 0) return 'both'
  if (lpOrderCount > 0) return 'lp_only'
  if (storeOrderCount > 0) return 'store_only'
  return 'none'
}
