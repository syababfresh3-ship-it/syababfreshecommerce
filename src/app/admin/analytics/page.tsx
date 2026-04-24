import { createClient } from '@/lib/supabase/server'
import { TrendingUp, ShoppingBag, Users, Package } from 'lucide-react'

async function getAnalytics() {
  const supabase = await createClient()

  // Last 7 days revenue
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [
    paidOrders,
    allOrders,
    topProductsRes,
    ordersByStatusRes,
    newCustomersRes,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('total, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', sevenDaysAgo.toISOString()),
    supabase
      .from('orders')
      .select('total, created_at')
      .gte('created_at', sevenDaysAgo.toISOString()),
    supabase
      .from('order_items')
      .select('product_name, product_image, quantity, subtotal'),
    supabase
      .from('orders')
      .select('status'),
    supabase
      .from('profiles')
      .select('created_at')
      .eq('is_admin', false)
      .gte('created_at', sevenDaysAgo.toISOString()),
  ])

  // Build daily revenue map (last 7 days)
  const days: { date: string; label: string; revenue: number; orders: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    days.push({
      date: dateStr,
      label: d.toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric' }),
      revenue: 0,
      orders: 0,
    })
  }

  for (const order of paidOrders.data ?? []) {
    const dateStr = order.created_at.slice(0, 10)
    const day = days.find((d) => d.date === dateStr)
    if (day) {
      day.revenue += Number(order.total)
      day.orders += 1
    }
  }

  // Top products by revenue
  const productMap: Record<string, { name: string; image: string | null; qty: number; revenue: number }> = {}
  for (const item of topProductsRes.data ?? []) {
    if (!productMap[item.product_name]) {
      productMap[item.product_name] = { name: item.product_name, image: item.product_image, qty: 0, revenue: 0 }
    }
    productMap[item.product_name].qty += item.quantity
    productMap[item.product_name].revenue += Number(item.subtotal)
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // Orders by status
  const statusCount: Record<string, number> = {}
  for (const o of ordersByStatusRes.data ?? []) {
    statusCount[o.status] = (statusCount[o.status] ?? 0) + 1
  }

  const totalRevenue7d = days.reduce((s, d) => s + d.revenue, 0)
  const totalOrders7d = (allOrders.data ?? []).length
  const newCustomers7d = (newCustomersRes.data ?? []).length
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1)

  return { days, topProducts, statusCount, totalRevenue7d, totalOrders7d, newCustomers7d, maxRevenue }
}

const statusLabel: Record<string, string> = {
  pending: 'Menunggu', confirmed: 'Disahkan', preparing: 'Disediakan',
  delivering: 'Dihantar', delivered: 'Selesai', cancelled: 'Dibatal',
}
const statusColor: Record<string, string> = {
  pending: 'bg-yellow-400', confirmed: 'bg-blue-400', preparing: 'bg-purple-400',
  delivering: 'bg-orange-400', delivered: 'bg-green-500', cancelled: 'bg-red-400',
}

export default async function AnalyticsPage() {
  const { days, topProducts, statusCount, totalRevenue7d, totalOrders7d, newCustomers7d, maxRevenue } = await getAnalytics()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Analitik</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-green-500 p-1.5 rounded-lg"><TrendingUp className="h-3.5 w-3.5 text-white" /></div>
            <span className="text-xs text-gray-500 font-medium">Jualan (7 hari)</span>
          </div>
          <p className="text-xl font-bold text-gray-900">RM{totalRevenue7d.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-500 p-1.5 rounded-lg"><ShoppingBag className="h-3.5 w-3.5 text-white" /></div>
            <span className="text-xs text-gray-500 font-medium">Pesanan (7 hari)</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalOrders7d}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-purple-500 p-1.5 rounded-lg"><Users className="h-3.5 w-3.5 text-white" /></div>
            <span className="text-xs text-gray-500 font-medium">Pelanggan Baru</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{newCustomers7d}</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Jualan 7 Hari Lepas</h2>
        <div className="flex items-end gap-2 h-36">
          {days.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-500 font-medium">
                {day.revenue > 0 ? `RM${day.revenue.toFixed(0)}` : ''}
              </span>
              <div className="w-full flex flex-col justify-end" style={{ height: '96px' }}>
                <div
                  className="w-full bg-brand-red-500 rounded-t-md transition-all"
                  style={{ height: `${Math.max((day.revenue / maxRevenue) * 96, day.revenue > 0 ? 4 : 0)}px` }}
                />
              </div>
              <span className="text-[9px] text-gray-400 text-center leading-tight">{day.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Top products */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-400" />
            Top 5 Produk
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Tiada data</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.qty} unit terjual</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 shrink-0">
                    RM{p.revenue.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders by status */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-gray-400" />
            Status Pesanan
          </h2>
          {Object.keys(statusCount).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Tiada data</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(statusCount)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const total = Object.values(statusCount).reduce((s, n) => s + n, 0)
                  const pct = Math.round((count / total) * 100)
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{statusLabel[status] ?? status}</span>
                        <span className="font-medium text-gray-900">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${statusColor[status] ?? 'bg-gray-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
