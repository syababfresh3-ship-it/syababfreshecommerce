import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { robots: { index: false, follow: false } }
import { Package, ShoppingBag, Users, TrendingUp } from 'lucide-react'

async function getStats() {
  const supabase = await createClient()

  const [products, orders, customers, revenue] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', false),
    supabase.from('orders').select('total').eq('payment_status', 'paid'),
  ])

  const totalRevenue = revenue.data?.reduce((sum, o) => sum + Number(o.total), 0) ?? 0

  return {
    products: products.count ?? 0,
    orders: orders.count ?? 0,
    customers: customers.count ?? 0,
    revenue: totalRevenue,
  }
}

async function getRecentOrders() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, status, total, created_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(8)
  return data ?? []
}

const statusStyles: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  preparing:  'bg-purple-100 text-purple-700',
  delivering: 'bg-orange-100 text-orange-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
  refunded:   'bg-gray-100 text-gray-700',
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

export default async function AdminDashboard() {
  const [stats, recentOrders] = await Promise.all([getStats(), getRecentOrders()])

  const statCards = [
    {
      label: 'Jualan (RM)',
      value: `RM ${stats.revenue.toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'bg-green-500',
    },
    {
      label: 'Pesanan',
      value: stats.orders.toString(),
      icon: ShoppingBag,
      color: 'bg-blue-500',
    },
    {
      label: 'Produk Aktif',
      value: stats.products.toString(),
      icon: Package,
      color: 'bg-orange-500',
    },
    {
      label: 'Pelanggan',
      value: stats.customers.toString(),
      icon: Users,
      color: 'bg-purple-500',
    },
  ]

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 font-medium">{card.label}</span>
              <div className={`${card.color} p-2 rounded-lg`}>
                <card.icon className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pesanan Terkini</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Pesanan</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tarikh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    Tiada pesanan lagi
                  </td>
                </tr>
              ) : (
                recentOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-gray-700">{order.order_number}</td>
                    <td className="px-5 py-3 text-gray-700">{order.profiles?.full_name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      RM {Number(order.total).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('ms-MY')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
