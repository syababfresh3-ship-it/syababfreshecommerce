import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { OrderFilters } from './order-filters'
import { PaymentToggle } from './payment-toggle'
import { Download } from 'lucide-react'

const statusStyles: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  preparing:  'bg-purple-100 text-purple-700',
  delivering: 'bg-orange-100 text-orange-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
  refunded:   'bg-gray-100 text-gray-600',
}

const statusLabel: Record<string, string> = {
  pending:    'Menunggu',
  confirmed:  'Disahkan',
  preparing:  'Disediakan',
  delivering: 'Dihantar',
  delivered:  'Selesai',
  cancelled:  'Dibatal',
  refunded:   'Dibayar Balik',
}

async function getOrders(status?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('orders')
    .select('id, order_number, status, total, payment_status, created_at, profiles(full_name, phone)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)

  const { data } = await query
  return data ?? []
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const orders = await getOrders(status)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Pesanan</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{orders.length} rekod</span>
          <a
            href="/api/admin/export-orders"
            download
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      <OrderFilters activeStatus={status} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Pesanan</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bayaran</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tarikh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">Tiada pesanan</td>
              </tr>
            ) : (
              orders.map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-xs text-red-600 hover:underline font-medium"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-gray-900">{order.profiles?.full_name ?? '—'}</div>
                    {order.profiles?.phone && (
                      <div className="text-xs text-gray-400">{order.profiles.phone}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <PaymentToggle orderId={order.id} currentStatus={order.payment_status} />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">
                    RM{Number(order.total).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500 text-xs">
                    {new Date(order.created_at).toLocaleDateString('ms-MY')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
