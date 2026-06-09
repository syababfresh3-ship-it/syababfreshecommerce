import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

  // Window backlog: 30 hari ke belakang. Order yang BELUM dispatch (tiada shipment)
  // dalam tempoh ini kekal muncul — termasuk yang "tak sempat hantar" hari sebelum.
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const rangeStart = new Date(todayStart)
  rangeStart.setDate(rangeStart.getDate() - 30)

  // Fetch orders — READ ONLY. Status confirmed/preparing sahaja (delivering = dah dispatch).
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, total, delivery_address, delivery_slot, notes, created_at, user_id, address_id')
    .in('status', ['confirmed', 'preparing'])
    .neq('delivery_method', 'pickup')   // order ambil sendiri tak masuk grouping
    // "Settled" sahaja (sama logik isOrderSettled): online (fpx/ewallet) WAJIB paid;
    // COD/bank_transfer bayar masa hantar. Buang draft online belum bayar (duplikat).
    .or('payment_status.eq.paid,payment_method.in.(cod,bank_transfer)')
    .gte('created_at', rangeStart.toISOString())
    .order('created_at', { ascending: true })

  if (!orders || orders.length === 0) return []

  // Buang order yang DAH ada shipment (dah dibook/dispatch — ada AWB). order_shipments
  // primary (refund_id null) = bukti dah dihantar → keluarkan dari grouping.
  const adminCli = createAdminClient()
  const { data: shipped } = await adminCli
    .from('order_shipments')
    .select('order_id')
    .is('refund_id', null)
    .in('order_id', orders.map((o) => o.id))
  const shippedSet = new Set((shipped ?? []).map((s) => s.order_id))
  const pendingOrders = orders.filter((o) => !shippedSet.has(o.id))

  if (pendingOrders.length === 0) return []

  // Fetch profiles for names & phones
  const userIds = [...new Set(pendingOrders.map((o) => o.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds)

  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>()
  for (const p of profiles ?? []) profileMap.set(p.id, p)

  // Fetch addresses for postcodes
  const addressIds = [...new Set(pendingOrders.map((o) => o.address_id).filter(Boolean))]
  let addressMap = new Map<string, { postcode: string | null; city: string | null; recipient_name: string | null; recipient_phone: string | null }>()
  if (addressIds.length > 0) {
    const { data: addresses } = await supabase
      .from('addresses')
      .select('id, postcode, city, recipient_name, recipient_phone')
      .in('id', addressIds)
    for (const a of addresses ?? []) addressMap.set(a.id, a)
  }

  // Fetch order items for summaries
  const orderIds = pendingOrders.map((o) => o.id)
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

  return pendingOrders.map((o) => {
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
      source: 'order' as const,
    }
  })
}

async function getLpOrders(rangeStart: Date): Promise<LalamoveOrder[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('lp_guest_orders')
    .select('id, order_number, name, phone, address, postcode, notes, status, total, payment_method, payment_status, created_at, items, product_name, variant_name, quantity')
    .in('status', ['confirmed', 'preparing'])
    .is('tracking_number', null)        // belum ada tracking = belum dispatch
    // Settled sahaja — buang order online (ewallet/fpx) yang belum bayar (draft/duplikat)
    .or('payment_status.eq.paid,payment_method.in.(cod,bank_transfer)')
    .gte('created_at', rangeStart.toISOString())
    .order('created_at', { ascending: true })

  return (data ?? []).map((lp: any) => {
    const items = (Array.isArray(lp.items) && lp.items.length > 0
      ? lp.items
      : [{ product_name: lp.product_name, variant_name: lp.variant_name, quantity: lp.quantity }]
    ).map((i: any) => ({ product_name: i.product_name, quantity: i.quantity, variant_name: i.variant_name ?? null }))
    return {
      id: lp.id,
      order_number: lp.order_number,
      status: lp.status,
      payment_status: lp.payment_status === 'paid' ? 'paid' : 'unpaid',  // status SEBENAR (badge Bayar/COD)
      total: lp.total,
      delivery_address: lp.address ?? null,
      delivery_slot: null,
      notes: lp.notes ?? null,
      created_at: lp.created_at,
      full_name: lp.name,
      phone: lp.phone,
      postcode: lp.postcode ?? null,
      city: null,
      recipient_name: lp.name,
      recipient_phone: lp.phone,
      items,
      source: 'lp' as const,
    }
  })
}

export default async function LalamoveGroupingPage() {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const rangeStart = new Date(todayStart); rangeStart.setDate(rangeStart.getDate() - 30)
  const [orders, lpOrders] = await Promise.all([getTodayOrders(), getLpOrders(rangeStart)])

  // Poskod yang ditanda 'Pos sahaja' (delivery_zones.courier_override) → Lalamove tak
  // sampai, jangan masuk grouping. Admin set di /admin/delivery.
  const admin = createAdminClient()
  const { data: ovRows } = await admin.from('delivery_zones').select('postcode').eq('courier_override', 'pos')
  const posOnly = new Set((ovRows ?? []).map((r) => r.postcode))

  const allOrders = [...orders, ...lpOrders]
    .filter((o) => !(o.postcode && posOnly.has(o.postcode)))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-orders={allOrders.length}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center shrink-0">
          <Truck className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lalamove Grouping</h1>
          <p className="text-sm text-gray-400">Belum dihantar · Klang Valley sahaja</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs bg-orange-100 text-orange-700 font-bold px-3 py-1.5 rounded-full">
            {allOrders.length} belum dihantar
          </span>
        </div>
      </div>

      <GroupingClient orders={allOrders} />
    </div>
  )
}
