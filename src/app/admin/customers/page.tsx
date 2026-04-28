export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { CustomersClient } from './customers-client'
import { getSegment } from './segment-utils'

async function getCustomers() {
  const supabase = createClient()

  const [profilesRes, ordersRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, loyalty_tiers(name)')
      .eq('is_admin', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('user_id, created_at, status')
      .in('status', ['confirmed', 'preparing', 'delivering', 'delivered']),
  ])

  const profiles = profilesRes.data ?? []
  const orders = ordersRes.data ?? []

  // Build per-user: lastOrderAt + orderCount
  const orderMap = new Map<string, { lastOrderAt: string; orderCount: number }>()
  for (const o of orders) {
    const cur = orderMap.get(o.user_id)
    if (!cur) {
      orderMap.set(o.user_id, { lastOrderAt: o.created_at, orderCount: 1 })
    } else {
      cur.orderCount++
      if (new Date(o.created_at) > new Date(cur.lastOrderAt)) cur.lastOrderAt = o.created_at
    }
  }

  return profiles.map(p => {
    const stats = orderMap.get(p.id)
    return {
      ...p,
      last_order_at: stats?.lastOrderAt ?? null,
      order_count: stats?.orderCount ?? 0,
      segment: getSegment({
        totalSpend: Number(p.total_spend ?? 0),
        createdAt: p.created_at,
        lastOrderAt: stats?.lastOrderAt ?? null,
        orderCount: stats?.orderCount ?? 0,
      }),
    }
  })
}

export default async function AdminCustomersPage() {
  const customers = await getCustomers()
  return (
    <div className="p-6">
      <CustomersClient customers={customers as any} />
    </div>
  )
}
