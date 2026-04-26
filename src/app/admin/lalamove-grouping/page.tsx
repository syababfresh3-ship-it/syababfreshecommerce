import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GroupingClient, type LalamoveOrder } from './grouping-client'
import { Truck } from 'lucide-react'

export const metadata = { title: 'Lalamove Grouping' }

// READ-ONLY: fetch today's orders for KV same-day grouping
async function getTodayOrders(): Promise<LalamoveOrder[]> {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/lalamove-grouping')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) redirect('/admin')

  // Today range (MY time = UTC+8)
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  // Fetch last 3 days to allow staff to catch up on backlog
  const rangeStart = new Date(todayStart)
  rangeStart.setDate(rangeStart.getDate() - 2)

  // Fetch orders — READ ONLY
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, total, delivery_address, delivery_slot, notes, created_at, user_id, address_id')
    .in('status', ['confirmed', 'preparing', 'delivering'])
    .gte('created_at', rangeStart.toISOString())
    .order('created_at', { ascending: true })

  if (!orders || orders.length === 0) return []

  // Fetch profiles for names & phones
  const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds)

  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>()
  for (const p of profiles ?? []) profileMap.set(p.id, p)

  // Fetch addresses for postcodes
  const addressIds = [...new Set(orders.map((o) => o.address_id).filter(Boolean))]
  let addressMap = new Map<string, { postcode: string | null; city: string | null; recipient_name: string | null; recipient_phone: string | null }>()
  if (addressIds.length > 0) {
    const { data: addresses } = await supabase
      .from('addresses')
      .select('id, postcode, city, recipient_name, recipient_phone')
      .in('id', addressIds)
    for (const a of addresses ?? []) addressMap.set(a.id, a)
  }

  // Fetch order items for summaries
  const orderIds = orders.map((o) => o.id)
  const { data: items } = await supabase
    .from('order_items')
    .select('order_id, product_name, quantity, variant_name')
    .in('order_id', orderIds)

  const itemsMap = new Map<string, { product_name: string; quantity: number; variant_name: string | null }[]>()
  for (const item of items ?? []) {
    const existing = itemsMap.get(item.order_id) ?? []
    existing.push({ product_name: item.product_name, quantity: item.quantity, variant_name: item.variant_name })
    itemsMap.set(item.order_id, existing)
  }

  return orders.map((o) => {
    const profile = profileMap.get(o.user_id)
    const address = o.address_id ? addressMap.get(o.address_id) : null
    return {
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      payment_status: o.payment_status,
      total: o.total,
      delivery_address: o.delivery_address,
      delivery_slot: o.delivery_slot,
      notes: o.notes,
      created_at: o.created_at,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      postcode: address?.postcode ?? null,
      city: address?.city ?? null,
      recipient_name: address?.recipient_name ?? null,
      recipient_phone: address?.recipient_phone ?? null,
      items: itemsMap.get(o.id) ?? [],
    }
  })
}

export default async function LalamoveGroupingPage() {
  const orders = await getTodayOrders()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
          <Truck className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lalamove Grouping</h1>
          <p className="text-sm text-gray-400">Same-day delivery · Klang Valley sahaja</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs bg-orange-100 text-orange-700 font-bold px-3 py-1.5 rounded-full">
            {orders.length} order tersedia
          </span>
        </div>
      </div>

      <GroupingClient orders={orders} />
    </div>
  )
}
