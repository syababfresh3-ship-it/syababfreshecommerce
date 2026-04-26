export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Suspense } from 'react'
import { OrderFilters } from './order-filters'
import { PaymentToggle } from './payment-toggle'
import { Download } from 'lucide-react'
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
  fpx: 'FPX',
  ewallet: 'E-Wallet',
  cod: 'COD',
  bank_transfer: 'Pindahan Bank',
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

async function getOrders(status?: string, q?: string) {
  const supabase = createAdminClient()
  let query = supabase
    .from('orders')
    .select('id, order_number, status, total, payment_status, payment_method, delivery_slot, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)
  if (q && !q.trim().match(/[a-zA-Z]/) === false) {
    query = query.ilike('order_number', `%${q}%`)
  }

  const { data: orders, error } = await query
  if (error || !orders || orders.length === 0) return []

  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds)

  const profileMap: Record<string, { full_name: string; phone: string }> = {}
  for (const p of profiles ?? []) profileMap[p.id] = p

  const enriched: OrderWithProfile[] = (orders as any[]).map((o) => ({
    ...o,
    profiles: profileMap[o.user_id] ?? null,
  }))

  if (q) {
    const lower = q.toLowerCase()
    return enriched.filter((o) =>
      o.order_number?.toLowerCase().includes(lower) ||
      o.profiles?.full_name?.toLowerCase().includes(lower) ||
      o.profiles?.phone?.includes(q)
    )
  }

  return enriched
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  const orders = await getOrders(status, q)

  return (
    <div className="p-6">
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
          Export CSV
        </a>
      </div>

      <Suspense><OrderFilters activeStatus={status} activeSearch={q} /></Suspense>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Pesanan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pelanggan</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Bayaran
                <span className="block text-[9px] font-normal text-gray-400 normal-case tracking-normal">klik untuk tukar</span>
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Masa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-gray-400">
                  {q ? `Tiada pesanan sepadan "${q}"` : 'Tiada pesanan'}
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const sc = statusConfig[order.status] ?? { label: order.status, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
                const dt = formatDate(order.created_at)
                return (
                  <tr key={order.id} className="hover:bg-blue-50/30 transition-colors group">
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
                    <td className="px-5 py-3.5 text-center">
                      <Link href={`/admin/orders/${order.id}`}>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </Link>
                      <div className="text-[10px] text-gray-400 mt-1">{methodLabel[(order as any).payment_method] ?? ''}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <PaymentToggle
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
    </div>
  )
}
