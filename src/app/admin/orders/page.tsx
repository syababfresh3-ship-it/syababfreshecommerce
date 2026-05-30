export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Suspense } from 'react'
import { OrderFilters } from './order-filters'
import { OrdersTableClient } from './orders-table-client'
import { Download, Zap, Package, Truck, Tag } from 'lucide-react'
import { LpOrdersSection } from './lp-orders-section'
import type { Order } from '@/types'

type OrderWithProfile = Order & { profiles: { full_name: string; phone: string } | null }

const statusConfig: Record<string, { label: string }> = {
  pending:    { label: 'Pending' },
  confirmed:  { label: 'Confirmed' },
  preparing:  { label: 'Preparing' },
  delivering: { label: 'Delivering' },
  delivered:  { label: 'Delivered' },
  cancelled:  { label: 'Cancelled' },
  refunded:   { label: 'Refunded' },
}

// Urgency level — lower = more urgent
function urgency(order: OrderWithProfile): number {
  const method = (order as any).payment_method
  if (order.status === 'pending' && (order.payment_status === 'paid' || method === 'cod' || method === 'bank_transfer')) return 0
  if (order.status === 'confirmed') return 1
  if (order.status === 'preparing') return 2
  if (order.status === 'pending' && order.payment_status === 'unpaid') return 3
  if (order.status === 'delivering') return 4
  if (order.status === 'delivered') return 5
  return 6
}


function dateRange(preset?: string): { gte?: string; lt?: string } {
  if (!preset) return {}
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === 'hari-ini') {
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    return { gte: today.toISOString(), lt: tomorrow.toISOString() }
  }
  if (preset === 'semalam') {
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    return { gte: yesterday.toISOString(), lt: today.toISOString() }
  }
  if (preset === '7-hari') {
    const week = new Date(today); week.setDate(today.getDate() - 6)
    return { gte: week.toISOString() }
  }
  if (preset === 'bulan-ini') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return { gte: monthStart.toISOString() }
  }
  return {}
}

async function getOrders(status?: string, q?: string, date?: string) {
  const supabase = createAdminClient()
  let query = supabase
    .from('orders')
    .select('id, order_number, status, total, payment_status, payment_method, delivery_slot, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(500)

  if (status) query = query.eq('status', status)

  const { gte, lt } = dateRange(date)
  if (gte) query = query.gte('created_at', gte)
  if (lt)  query = query.lt('created_at', lt)

  const { data: orders, error } = await query
  if (error || !orders || orders.length === 0) return []

  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds)

  const profileMap: Record<string, { full_name: string; phone: string }> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p

  let enriched: OrderWithProfile[] = (orders as any[]).map((o) => ({
    ...o,
    profiles: profileMap[o.user_id] ?? null,
  }))

  if (q) {
    const lower = q.toLowerCase()
    enriched = enriched.filter((o) =>
      o.order_number?.toLowerCase().includes(lower) ||
      o.profiles?.full_name?.toLowerCase().includes(lower) ||
      o.profiles?.phone?.includes(q)
    )
  }

  // Sort by urgency, then by time (newest first within same urgency)
  enriched.sort((a, b) => {
    const ua = urgency(a), ub = urgency(b)
    if (ua !== ub) return ua - ub
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return enriched
}

async function getStatusCounts() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('orders')
    .select('status, payment_status, payment_method')
    .not('status', 'in', '(delivered,cancelled,refunded)')

  if (!data) return { needAction: 0, confirmed: 0, preparing: 0, delivering: 0 }

  const needAction = data.filter(o =>
    o.status === 'pending' && (o.payment_status === 'paid' || o.payment_method === 'cod' || o.payment_method === 'bank_transfer')
  ).length
  const confirmed  = data.filter(o => o.status === 'confirmed').length
  const preparing  = data.filter(o => o.status === 'preparing').length
  const delivering = data.filter(o => o.status === 'delivering').length

  return { needAction, confirmed, preparing, delivering }
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; date?: string }>
}) {
  const { status, q, date } = await searchParams
  const supabaseForLp = createAdminClient()
  const [orders, counts, lpOrdersRes] = await Promise.all([
    getOrders(status, q, date),
    getStatusCounts(),
    supabaseForLp.from('lp_guest_orders')
      .select('id, order_number, name, phone, address, postcode, notes, status, payment_status, total, payment_method, delivery_fee, created_at, items, product_name, variant_name, quantity, unit_price, landing_pages(title, slug)')
      .not('status', 'in', '(delivered,cancelled)')
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  // Hide unpaid online (FPX/e-wallet) orders — customer opened the payment page but
  // never paid. COD/bank orders always show (no online payment to wait for).
  const allLpOrders = (lpOrdersRes.data ?? []).filter((o: any) =>
    ['fpx', 'ewallet'].includes(o.payment_method) ? o.payment_status === 'paid' : true
  )
  const lpOrders = allLpOrders.filter((o: any) => o.status === 'pending')

  // Transform LP orders to match Order shape for the table
  const lpAsOrders = allLpOrders.map((lp: any) => ({
    id: lp.id,
    order_number: lp.order_number,
    status: lp.status,
    total: lp.total,
    payment_method: lp.payment_method,
    payment_status: lp.payment_status ?? 'unpaid',
    created_at: lp.created_at,
    delivery_slot: null,
    needs_approval: false,
    user_id: null,
    profiles: { full_name: lp.name, phone: lp.phone },
    order_items: (Array.isArray(lp.items) && lp.items.length > 0
      ? lp.items
      : [{ product_name: lp.product_name, variant_name: lp.variant_name, quantity: lp.quantity }]
    ).map((i: any) => ({
      product_name: `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''}`,
      quantity: i.quantity,
    })),
    _isLp: true,
    _lpTitle: Array.isArray(lp.landing_pages) ? lp.landing_pages[0]?.title : lp.landing_pages?.title,
  }))

  // Merge and sort by created_at desc
  const allOrders = [...orders, ...lpAsOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const summaryItems = [
    { icon: Zap,          label: 'Perlu Confirm', count: counts.needAction, color: 'text-red-600 bg-red-50 border-red-200',      status: 'pending' },
    { icon: Package,      label: 'Confirmed',     count: counts.confirmed,  color: 'text-blue-600 bg-blue-50 border-blue-200',    status: 'confirmed' },
    { icon: Package,      label: 'Preparing',   count: counts.preparing,  color: 'text-purple-600 bg-purple-50 border-purple-200', status: 'preparing' },
    { icon: Truck,        label: 'Delivering',     count: counts.delivering, color: 'text-orange-600 bg-orange-50 border-orange-200', status: 'delivering' },
  ].filter(s => s.count > 0)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="font-semibold text-gray-600">{allOrders.length}</span> records
            {status ? <span className="text-gray-300"> · </span> : ''}
            {status ? <span className="text-gray-500">{statusConfig[status]?.label ?? status}</span> : ''}
            {date ? <span className="text-gray-300"> · </span> : ''}
            {date ? <span className="text-blue-500 font-medium">{date === 'hari-ini' ? 'Today' : date === 'semalam' ? 'Yesterday' : date === '7-hari' ? 'Last 7 Days' : 'This Month'}</span> : ''}
          </p>
        </div>
        <a
          href="/api/admin/export-orders"
          download
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3.5 py-2 rounded-xl hover:bg-gray-50 shadow-sm transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
        </a>
      </div>

      {/* Summary strip — shows what needs attention */}
      {summaryItems.length > 0 && (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4">
          {summaryItems.map((s) => (
            <Link
              key={s.status}
              href={`/admin/orders?status=${s.status}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all hover:shadow-md hover:-translate-y-0.5 ${s.color}`}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <div>
                <div className="text-base font-black leading-none">{s.count}</div>
                <div className="font-medium opacity-80 leading-tight mt-0.5">{s.label}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* LP Orders section */}
      {lpOrders.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-rose-600 shadow-sm mb-3">
            <Tag className="h-4 w-4 text-white" />
            <span className="text-sm font-bold text-white flex-1">New LP Orders — Awaiting Confirmation</span>
            <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">{lpOrders.length}</span>
          </div>
          <LpOrdersSection lpOrders={lpOrders.map((o: any) => ({ ...o, landing_pages: Array.isArray(o.landing_pages) ? o.landing_pages[0] ?? null : o.landing_pages }))} />
        </div>
      )}

      <Suspense><OrderFilters activeStatus={status} activeSearch={q} activeDate={date} /></Suspense>

      <OrdersTableClient orders={allOrders as any} searchQuery={q} />

      {/* Flow guide */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2.5">Order Flow</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Pending',   color: 'bg-yellow-400', hint: 'Awaiting payment' },
            { label: 'Confirmed',   color: 'bg-blue-400',   hint: 'Start preparing' },
            { label: 'Preparing', color: 'bg-purple-400', hint: 'Pack & ship' },
            { label: 'Delivering',   color: 'bg-orange-400', hint: 'In transit' },
            { label: 'Delivered',    color: 'bg-green-400',  hint: 'Diterima' },
          ].map((step, i, arr) => (
            <span key={step.label} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${step.color}`} />
                <span className="text-xs font-semibold text-gray-600">{step.label}</span>
                <span className="text-[10px] text-gray-400 hidden sm:inline">{step.hint}</span>
              </span>
              {i < arr.length - 1 && <span className="text-gray-200 text-sm">›</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
