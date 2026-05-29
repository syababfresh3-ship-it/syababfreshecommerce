export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { CustomersClient } from './customers-client'
import { getSegment, getChannel } from './segment-utils'

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('0')) p = '6' + p
  if (!p.startsWith('60')) p = '60' + p
  return p
}

async function getCustomers() {
  const supabase = createClient()

  const [profilesRes, ordersRes, lpOrdersRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, loyalty_tiers(name)')
      .eq('is_admin', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('user_id, created_at, total, status')
      .in('status', ['confirmed', 'preparing', 'delivering', 'delivered']),
    supabase
      .from('lp_guest_orders')
      .select('phone, total, status, created_at')
      .in('status', ['pending', 'confirmed']),
  ])

  const profiles = profilesRes.data ?? []
  const orders = ordersRes.data ?? []
  const lpOrders = lpOrdersRes.data ?? []

  // Build per-user: lastOrderAt + orderCount + totalSpentStore
  const orderMap = new Map<string, { lastOrderAt: string; orderCount: number; totalSpent: number }>()
  for (const o of orders) {
    const cur = orderMap.get(o.user_id)
    if (!cur) {
      orderMap.set(o.user_id, { lastOrderAt: o.created_at, orderCount: 1, totalSpent: Number(o.total) })
    } else {
      cur.orderCount++
      cur.totalSpent += Number(o.total)
      if (new Date(o.created_at) > new Date(cur.lastOrderAt)) cur.lastOrderAt = o.created_at
    }
  }

  // Build LP order map by normalized phone
  const lpMap = new Map<string, { orderCount: number; totalSpent: number }>()
  for (const lp of lpOrders) {
    if (!lp.phone) continue
    const key = normalizePhone(lp.phone)
    const cur = lpMap.get(key)
    if (!cur) lpMap.set(key, { orderCount: 1, totalSpent: Number(lp.total) })
    else { cur.orderCount++; cur.totalSpent += Number(lp.total) }
  }

  return profiles.map(p => {
    const stats = orderMap.get(p.id)
    const lpStats = p.phone ? lpMap.get(normalizePhone(p.phone)) : undefined
    const orderCount = stats?.orderCount ?? 0
    const lpOrderCount = lpStats?.orderCount ?? 0
    const totalSpend = Number(p.total_spend ?? 0)
    const lpSpend = lpStats?.totalSpent ?? 0
    const aov = orderCount > 0 ? totalSpend / orderCount : null
    return {
      ...p,
      last_order_at: stats?.lastOrderAt ?? null,
      order_count: orderCount,
      lp_order_count: lpOrderCount,
      lp_spend: lpSpend,
      aov,
      segment: getSegment({
        totalSpend,
        createdAt: p.created_at,
        lastOrderAt: stats?.lastOrderAt ?? null,
        orderCount,
      }),
      channel: getChannel(orderCount, lpOrderCount),
    }
  })
}

export default async function AdminCustomersPage() {
  const customers = await getCustomers()
  return (
    <div className="p-4 md:p-6">
      <CustomersClient customers={customers as any} />
    </div>
  )
}
