export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Suspense } from 'react'
import { OrderFilters } from './order-filters'
import { StatusDropdown, PaymentDropdown } from './order-dropdowns'
import { Download, Zap, Package, Truck } from 'lucide-react'
import type { Order } from '@/types'

type OrderWithProfile = Order & { profiles: { full_name: string; phone: string } | null }

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Menunggu',      cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed:  { label: 'Disahkan',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  preparing:  { label: 'Disediakan',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  delivering: { label: 'Dihantar',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  delivered:  { label: 'Selesai',      cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:  { label: 'Dibatal',      cls: 'bg-red-50 text-red-600 border-red-200' },
  refunded:   { label: 'Dibayar Balik',cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const methodLabel: Record<string, string> = {
  fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Pindahan Bank',
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString()
  const time = date.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return { top: 'Hari ini', bottom: time }
  if (isYesterday) return { top: 'Semalam', bottom: time }
  return {
    top: date.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' }),
    bottom: time,
  }
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

function getActionInfo(order: OrderWithProfile): { label: string; color: string; border: string } {
  const method = (order as any).payment_method
  const isPaid = order.payment_status === 'paid' || method === 'cod' || method === 'bank_transfer'

  if (order.status === 'pending' && isPaid)
    return { label: '⚡ Sahkan pesanan', color: 'text-red-600 font-bold', border: 'border-l-4 border-l-red-400' }
  if (order.status === 'pending' && !isPaid)
    return { label: '⏳ Tunggu bayaran', color: 'text-yellow-600', border: 'border-l-4 border-l-yellow-300' }
  if (order.status === 'confirmed')
    return { label: '📦 Mula sediakan', color: 'text-blue-600 font-semibold', border: 'border-l-4 border-l-blue-400' }
  if (order.status === 'preparing')
    return { label: '🚚 Tandakan dihantar', color: 'text-purple-600 font-semibold', border: 'border-l-4 border-l-purple-400' }
  if (order.status === 'delivering')
    return { label: '📍 Dalam penghantaran', color: 'text-orange-500', border: 'border-l-4 border-l-orange-300' }
  if (order.status === 'delivered')
    return { label: '✓ Selesai', color: 'text-green-600', border: 'border-l-[3px] border-l-green-200' }
  return { label: '—', color: 'text-gray-400', border: '' }
}

async function getOrders(status?: string, q?: string) {
  const supabase = createAdminClient()
  let query = supabase
    .from('orders')
    .select('id, order_number, status, total, payment_status, payment_method, delivery_slot, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)

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
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  const [orders, counts] = await Promise.all([getOrders(status, q), getStatusCounts()])

  const summaryItems = [
    { icon: Zap,          label: 'Perlu Sahkan', count: counts.needAction, color: 'text-red-600 bg-red-50 border-red-200',      status: 'pending' },
    { icon: Package,      label: 'Disahkan',     count: counts.confirmed,  color: 'text-blue-600 bg-blue-50 border-blue-200',    status: 'confirmed' },
    { icon: Package,      label: 'Disediakan',   count: counts.preparing,  color: 'text-purple-600 bg-purple-50 border-purple-200', status: 'preparing' },
    { icon: Truck,        label: 'Dihantar',     count: counts.delivering, color: 'text-orange-600 bg-orange-50 border-orange-200', status: 'delivering' },
  ].filter(s => s.count > 0)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pesanan</h1>
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} rekod {status ? `· ${statusConfig[status]?.label ?? status}` : ''}</p>
        </div>
        <a
          href="/api/admin/export-orders"
          download
          className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
        </a>
      </div>

      {/* Summary strip — shows what needs attention */}
      {summaryItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {summaryItems.map((s) => (
            <Link
              key={s.status}
              href={`/admin/orders?status=${s.status}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all hover:shadow-sm ${s.color}`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.count} {s.label}
            </Link>
          ))}
        </div>
      )}

      <Suspense><OrderFilters activeStatus={status} activeSearch={q} /></Suspense>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {orders.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-14">
            {q ? `Tiada pesanan sepadan "${q}"` : 'Tiada pesanan'}
          </p>
        ) : orders.map((order) => {
          const sc = statusConfig[order.status] ?? { label: order.status, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
          const dt = formatDate(order.created_at)
          const action = getActionInfo(order)
          return (
            <div key={order.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${action.border}`}>
              <Link href={`/admin/orders/${order.id}`} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold text-red-600">{order.order_number}</span>
                    <span className={`text-[10px] font-semibold ${action.color}`}>{action.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{order.profiles?.full_name ?? '—'}</p>
                  {order.profiles?.phone && (
                    <p className="text-xs text-gray-400">{order.profiles.phone}</p>
                  )}
                  {(order as any).delivery_slot && (
                    <p className="text-[10px] text-blue-600 font-medium mt-0.5">🕐 {(order as any).delivery_slot}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${sc.cls}`}>
                    {sc.label}
                  </span>
                  <span className="font-bold text-gray-900 text-sm">RM{Number(order.total).toFixed(2)}</span>
                  <span className="text-[10px] text-gray-400">{dt.top} {dt.bottom}</span>
                </div>
              </Link>
              <div className="px-4 pb-3 border-t border-gray-50 pt-2 flex items-center gap-3">
                <StatusDropdown orderId={order.id} currentStatus={order.status} />
                <PaymentDropdown
                  orderId={order.id}
                  currentStatus={order.payment_status}
                  paymentMethod={(order as any).payment_method}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Pesanan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pelanggan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tindakan Perlu</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Bayaran</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Masa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center text-gray-400">
                  {q ? `Tiada pesanan sepadan "${q}"` : 'Tiada pesanan'}
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const sc = statusConfig[order.status] ?? { label: order.status, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
                const dt = formatDate(order.created_at)
                const action = getActionInfo(order)
                return (
                  <tr key={order.id} className={`hover:bg-gray-50/60 transition-colors ${action.border}`}>
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs text-red-600 hover:underline font-bold block">
                        {order.order_number}
                      </Link>
                      {(order as any).delivery_slot && (
                        <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">
                          🕐 {(order as any).delivery_slot}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900 text-sm">{order.profiles?.full_name ?? '—'}</div>
                      {order.profiles?.phone && (
                        <a href={`tel:${order.profiles.phone}`} className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                          {order.profiles.phone}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/orders/${order.id}`} className={`text-xs ${action.color} hover:underline`}>
                        {action.label}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <StatusDropdown orderId={order.id} currentStatus={order.status} />
                      <div className="text-[10px] text-gray-400 mt-1">{methodLabel[(order as any).payment_method] ?? ''}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <PaymentDropdown
                        orderId={order.id}
                        currentStatus={order.payment_status}
                        paymentMethod={(order as any).payment_method}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-900">RM{Number(order.total).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-xs font-medium text-gray-600 block">{dt.top}</span>
                      <span className="text-xs text-gray-400">{dt.bottom}</span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Flow guide — helps staff understand the pipeline */}
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Aliran Pesanan</p>
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500">
          {[
            { label: 'Menunggu',    color: 'bg-yellow-400', hint: 'bayaran diterima' },
            { label: 'Disahkan',    color: 'bg-blue-400',   hint: 'mula sediakan' },
            { label: 'Disediakan',  color: 'bg-purple-400', hint: 'pack & hantar' },
            { label: 'Dihantar',    color: 'bg-orange-400', hint: 'dalam transit' },
            { label: 'Selesai',     color: 'bg-green-400',  hint: 'diterima customer' },
          ].map((step, i, arr) => (
            <span key={step.label} className="flex items-center gap-1.5">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${step.color}`} />
                <span className="font-semibold text-gray-700">{step.label}</span>
                <span className="text-gray-400 text-[10px]">({step.hint})</span>
              </span>
              {i < arr.length - 1 && <span className="text-gray-300">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
