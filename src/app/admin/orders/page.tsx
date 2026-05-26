export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Suspense } from 'react'
import { OrderFilters } from './order-filters'
import { OrdersTableClient } from './orders-table-client'
import { Download, Zap, Package, Truck } from 'lucide-react'
import type { Order } from '@/types'

type OrderWithProfile = Order & { profiles: { full_name: string; phone: string } | null }

const statusConfig: Record<string, { label: string }> = {
  pending:    { label: 'Menunggu' },
  confirmed:  { label: 'Disahkan' },
  preparing:  { label: 'Disediakan' },
  delivering: { label: 'Dihantar' },
  delivered:  { label: 'Selesai' },
  cancelled:  { label: 'Dibatal' },
  refunded:   { label: 'Dibayar Balik' },
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
  const [orders, counts] = await Promise.all([getOrders(status, q, date), getStatusCounts()])

  const summaryItems = [
    { icon: Zap,          label: 'Perlu Sahkan', count: counts.needAction, color: 'text-red-600 bg-red-50 border-red-200',      status: 'pending' },
    { icon: Package,      label: 'Disahkan',     count: counts.confirmed,  color: 'text-blue-600 bg-blue-50 border-blue-200',    status: 'confirmed' },
    { icon: Package,      label: 'Disediakan',   count: counts.preparing,  color: 'text-purple-600 bg-purple-50 border-purple-200', status: 'preparing' },
    { icon: Truck,        label: 'Dihantar',     count: counts.delivering, color: 'text-orange-600 bg-orange-50 border-orange-200', status: 'delivering' },
  ].filter(s => s.count > 0)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pesanan</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="font-semibold text-gray-600">{orders.length}</span> rekod
            {status ? <span className="text-gray-300"> · </span> : ''}
            {status ? <span className="text-gray-500">{statusConfig[status]?.label ?? status}</span> : ''}
            {date ? <span className="text-gray-300"> · </span> : ''}
            {date ? <span className="text-blue-500 font-medium">{date === 'hari-ini' ? 'Hari Ini' : date === 'semalam' ? 'Semalam' : date === '7-hari' ? '7 Hari Lepas' : 'Bulan Ini'}</span> : ''}
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

      <Suspense><OrderFilters activeStatus={status} activeSearch={q} activeDate={date} /></Suspense>

      <OrdersTableClient orders={orders} searchQuery={q} />

      {/* Flow guide */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2.5">Aliran Pesanan</p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Menunggu',   color: 'bg-yellow-400', hint: 'Tunggu bayaran' },
            { label: 'Disahkan',   color: 'bg-blue-400',   hint: 'Mula sediakan' },
            { label: 'Disediakan', color: 'bg-purple-400', hint: 'Pack & hantar' },
            { label: 'Dihantar',   color: 'bg-orange-400', hint: 'Dalam transit' },
            { label: 'Selesai',    color: 'bg-green-400',  hint: 'Diterima' },
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
