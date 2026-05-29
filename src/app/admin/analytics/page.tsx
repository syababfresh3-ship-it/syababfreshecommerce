export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { TrendingUp, ShoppingBag, Users, Package, ImageOff, BarChart3 } from 'lucide-react'

async function getAnalytics() {
  const supabase = createClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const [
    paidOrders,
    allOrders,
    topProductsRes,
    ordersByStatusRes,
    newCustomersRes,
    lpPaidOrders,
    lpAllOrders,
  ] = await Promise.all([
    supabase.from('orders').select('total, created_at').eq('payment_status', 'paid').gte('created_at', sevenDaysAgo.toISOString()),
    supabase.from('orders').select('total, created_at').gte('created_at', sevenDaysAgo.toISOString()),
    supabase.from('order_items').select('product_name, product_image, quantity, subtotal'),
    supabase.from('orders').select('status').gte('created_at', sevenDaysAgo.toISOString()),
    supabase.from('profiles').select('created_at').eq('is_admin', false).gte('created_at', sevenDaysAgo.toISOString()),
    supabase.from('lp_guest_orders').select('total, created_at').eq('status', 'confirmed').gte('created_at', sevenDaysAgo.toISOString()),
    supabase.from('lp_guest_orders').select('total, created_at, status, items').gte('created_at', sevenDaysAgo.toISOString()),
  ])

  const days: { date: string; label: string; dayLabel: string; revenue: number; orders: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    days.push({
      date: dateStr,
      label: d.toLocaleDateString('en-MY', { weekday: 'short' }),
      dayLabel: d.toLocaleDateString('en-MY', { day: 'numeric' }),
      revenue: 0,
      orders: 0,
    })
  }

  // Merge main store + LP paid orders into daily chart
  for (const order of [...(paidOrders.data ?? []), ...(lpPaidOrders.data ?? [])]) {
    const dateStr = order.created_at.slice(0, 10)
    const day = days.find((d) => d.date === dateStr)
    if (day) { day.revenue += Number(order.total); day.orders += 1 }
  }

  const productMap: Record<string, { name: string; image: string | null; qty: number; revenue: number }> = {}
  for (const item of topProductsRes.data ?? []) {
    if (!productMap[item.product_name]) {
      productMap[item.product_name] = { name: item.product_name, image: item.product_image, qty: 0, revenue: 0 }
    }
    productMap[item.product_name].qty += item.quantity
    productMap[item.product_name].revenue += Number(item.subtotal)
  }
  // Add LP order items to top products
  for (const lpOrder of lpAllOrders.data ?? []) {
    const items: any[] = Array.isArray(lpOrder.items) ? lpOrder.items : []
    for (const item of items) {
      if (!item.product_name) continue
      if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, image: null, qty: 0, revenue: 0 }
      productMap[item.product_name].qty += item.quantity ?? 1
      productMap[item.product_name].revenue += Number(item.unit_price ?? 0) * (item.quantity ?? 1)
    }
  }
  const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)

  const statusCount: Record<string, number> = {}
  for (const o of ordersByStatusRes.data ?? []) {
    statusCount[o.status] = (statusCount[o.status] ?? 0) + 1
  }
  // LP status (prefix lp_ to distinguish)
  for (const o of lpAllOrders.data ?? []) {
    const key = `lp_${o.status}`
    statusCount[key] = (statusCount[key] ?? 0) + 1
  }

  const totalRevenue7d = days.reduce((s, d) => s + d.revenue, 0)
  const totalOrders7d = (allOrders.data ?? []).length + (lpAllOrders.data ?? []).length
  const newCustomers7d = (newCustomersRes.data ?? []).length
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1)
  const lpOrders7d = (lpAllOrders.data ?? []).length

  return { days, topProducts, statusCount, totalRevenue7d, totalOrders7d, newCustomers7d, maxRevenue, lpOrders7d }
}

const statusLabel: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  delivering: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
  lp_pending: 'LP — Pending', lp_confirmed: 'LP — Confirmed', lp_cancelled: 'LP — Cancelled',
}
const statusColor: Record<string, string> = {
  pending: 'bg-yellow-400', confirmed: 'bg-blue-500', preparing: 'bg-purple-500',
  delivering: 'bg-orange-400', delivered: 'bg-green-500', cancelled: 'bg-red-400',
  lp_pending: 'bg-rose-300', lp_confirmed: 'bg-rose-500', lp_cancelled: 'bg-gray-400',
}
const statusDot: Record<string, string> = {
  pending: 'bg-yellow-400', confirmed: 'bg-blue-500', preparing: 'bg-purple-500',
  delivering: 'bg-orange-400', delivered: 'bg-green-500', cancelled: 'bg-red-400',
  lp_pending: 'bg-rose-300', lp_confirmed: 'bg-rose-500', lp_cancelled: 'bg-gray-400',
}

const RANK_STYLES = [
  'bg-yellow-100 text-yellow-700 border-yellow-200',
  'bg-gray-100 text-gray-500 border-gray-200',
  'bg-orange-100 text-orange-600 border-orange-200',
]

export default async function AnalyticsPage() {
  const { days, topProducts, statusCount, totalRevenue7d, totalOrders7d, newCustomers7d, maxRevenue, lpOrders7d } = await getAnalytics()
  const totalStatusOrders = Object.values(statusCount).reduce((s, n) => s + n, 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">Performance — last 7 days</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500">Jualan (7 Hari)</span>
            <div className="bg-green-100 p-1.5 rounded-lg"><TrendingUp className="h-3.5 w-3.5 text-green-600" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">RM{totalRevenue7d.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">store + LP paid orders</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500">Orders (7 Hari)</span>
            <div className="bg-blue-100 p-1.5 rounded-lg"><ShoppingBag className="h-3.5 w-3.5 text-blue-600" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">{totalOrders7d}</p>
          <p className="text-xs text-gray-400 mt-1">store + LP ({lpOrders7d} LP)</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500">Customer New</span>
            <div className="bg-purple-100 p-1.5 rounded-lg"><Users className="h-3.5 w-3.5 text-purple-600" /></div>
          </div>
          <p className="text-2xl font-black text-gray-900">{newCustomers7d}</p>
          <p className="text-xs text-gray-400 mt-1">new registrations</p>
        </div>
      </div>

      {/* Revenue bar chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <h2 className="font-bold text-gray-900">Revenue — Last 7 Days</h2>
        </div>
        <div className="flex items-end gap-3 h-40">
          {days.map((day, i) => {
            const isToday = i === 6
            const heightPct = day.revenue > 0 ? Math.max((day.revenue / maxRevenue) * 100, 4) : 0
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-gray-500 font-semibold h-4 flex items-center">
                  {day.revenue > 0 ? `RM${day.revenue.toFixed(0)}` : ''}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: '104px' }}>
                  <div
                    className={`w-full rounded-t-lg transition-all ${isToday ? 'bg-red-600' : 'bg-red-200'}`}
                    style={{ height: `${heightPct}%`, minHeight: day.revenue > 0 ? '4px' : '0' }}
                  />
                </div>
                <div className="text-center">
                  <p className={`text-[10px] font-bold ${isToday ? 'text-gray-900' : 'text-gray-400'}`}>{day.label}</p>
                  <p className="text-[9px] text-gray-300">{day.dayLabel}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900">Top 5 Product</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No data jualan</div>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className={`text-[10px] font-black w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${RANK_STYLES[i] ?? 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                    {i + 1}
                  </span>
                  <div className="h-8 w-8 rounded-lg border border-gray-100 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff className="h-3 w-3 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{p.name}</p>
                    <p className="text-[10px] text-gray-400">{p.qty} unit</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0">
                    RM{p.revenue.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders by status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-4 w-4 text-gray-400" />
            <h2 className="font-bold text-gray-900">Status Orders</h2>
            {totalStatusOrders > 0 && (
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{totalStatusOrders} orders</span>
            )}
          </div>
          {Object.keys(statusCount).length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No orders minggu ini</div>
          ) : (
            <div className="space-y-3">
              {Object.entries(statusCount)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => {
                  const pct = Math.round((count / totalStatusOrders) * 100)
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${statusDot[status] ?? 'bg-gray-300'}`} />
                          <span className="text-xs font-medium text-gray-700">{statusLabel[status] ?? status}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900">{count}</span>
                          <span className="text-[10px] text-gray-400">({pct}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${statusColor[status] ?? 'bg-gray-400'}`}
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
