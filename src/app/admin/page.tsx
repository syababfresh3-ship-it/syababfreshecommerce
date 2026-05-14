import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import {
  Package, ShoppingBag, Users, TrendingUp,
  ClipboardList, AlertTriangle, RotateCcw, Plus,
  Clock, ArrowRight, Banknote,
} from 'lucide-react'

export const metadata: Metadata = { robots: { index: false, follow: false } }

async function getStats() {
  const supabase = createAdminClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    allRevenue, todayOrders, todayRevenue,
    totalOrders, activeProducts, customers,
    pendingOrders, pendingRefunds, lowStock,
  ] = await Promise.all([
    supabase.from('orders').select('total').eq('payment_status', 'paid'),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supabase.from('orders').select('total')
      .eq('payment_status', 'paid').gte('created_at', todayStart.toISOString()),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', false),
    supabase.from('orders').select('id, order_number, created_at')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 10 * 60_000).toISOString())
      .order('created_at', { ascending: true })
      .limit(5),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled').eq('payment_status', 'paid'),
    supabase.from('product_stock').select('product_id, available_stock')
      .lt('available_stock', 5),
  ])

  return {
    revenue: allRevenue.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0,
    todayRevenue: todayRevenue.data?.reduce((s, o) => s + Number(o.total), 0) ?? 0,
    todayOrders: todayOrders.count ?? 0,
    totalOrders: totalOrders.count ?? 0,
    products: activeProducts.count ?? 0,
    customers: customers.count ?? 0,
    urgentPending: pendingOrders.data ?? [],
    pendingRefunds: pendingRefunds.count ?? 0,
    lowStockCount: lowStock.data?.length ?? 0,
  }
}

async function getRecentOrders() {
  const supabase = createAdminClient()
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total, payment_status, payment_method, created_at, user_id, delivery_slot')
    .order('created_at', { ascending: false })
    .limit(8)
  if (!orders || orders.length === 0) return []

  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))]
  const { data: profiles } = await supabase
    .from('profiles').select('id, full_name, phone').in('id', userIds)

  const pm: Record<string, { full_name: string; phone: string }> = {}
  for (const p of profiles ?? []) pm[p.id] = p

  return orders.map((o: any) => ({ ...o, profiles: pm[o.user_id] ?? null }))
}

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'baru sahaja'
  if (mins < 60) return `${mins} minit lalu`
  return `${Math.floor(mins / 60)} jam lalu`
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Menunggu',    cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  confirmed:  { label: 'Disahkan',   cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  preparing:  { label: 'Disediakan', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  delivering: { label: 'Dihantar',   cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  delivered:  { label: 'Selesai',    cls: 'bg-green-100 text-green-700 border-green-200' },
  cancelled:  { label: 'Dibatal',    cls: 'bg-red-100 text-red-600 border-red-200' },
  refunded:   { label: 'Dibayar Balik', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}

export default async function AdminDashboard() {
  const [stats, recentOrders] = await Promise.all([getStats(), getRecentOrders()])
  const hasAlerts = stats.urgentPending.length > 0 || stats.pendingRefunds > 0 || stats.lowStockCount > 0

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl">

      {/* ALERTS */}
      {hasAlerts && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-amber-400 rounded-full p-1">
              <AlertTriangle className="h-3.5 w-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-amber-900">Perlu Perhatian Segera</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.urgentPending.length > 0 && (
              <Link href="/admin/fulfillment"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm">
                <Clock className="h-3.5 w-3.5" />
                {stats.urgentPending.length} pesanan menunggu &gt;10 minit
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {stats.pendingRefunds > 0 && (
              <Link href="/admin/refunds"
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm">
                <RotateCcw className="h-3.5 w-3.5" />
                {stats.pendingRefunds} refund tertunggak
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {stats.lowStockCount > 0 && (
              <Link href="/admin/inventory"
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm">
                <Package className="h-3.5 w-3.5" />
                {stats.lowStockCount} produk stok rendah
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Pesanan Hari Ini"
          value={stats.todayOrders.toString()}
          sub={`${stats.totalOrders} keseluruhan`}
          icon={ShoppingBag}
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          label="Jualan Hari Ini"
          value={`RM${stats.todayRevenue.toFixed(2)}`}
          sub={`RM${stats.revenue.toLocaleString('ms-MY', { minimumFractionDigits: 2 })} keseluruhan`}
          icon={Banknote}
          gradient="from-emerald-500 to-emerald-600"
        />
        <StatCard
          label="Produk Aktif"
          value={stats.products.toString()}
          icon={Package}
          gradient="from-orange-500 to-orange-600"
        />
        <StatCard
          label="Pelanggan"
          value={stats.customers.toString()}
          icon={Users}
          gradient="from-violet-500 to-violet-600"
        />
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Tindakan Pantas</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/fulfillment"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-sm">
            <ClipboardList className="h-4 w-4" /> Buka Fulfillment
          </Link>
          <Link href="/admin/orders"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
            <ShoppingBag className="h-4 w-4" /> Senarai Pesanan
          </Link>
          <Link href="/admin/products/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
            <Plus className="h-4 w-4" /> Tambah Produk
          </Link>
          <Link href="/admin/inventory"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
            <Package className="h-4 w-4" /> Tambah Stok
          </Link>
        </div>
      </div>

      {/* RECENT ORDERS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Pesanan Terkini</h2>
          <Link href="/admin/orders" className="text-xs text-red-600 hover:underline font-semibold flex items-center gap-1">
            Lihat semua <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentOrders.length === 0 ? (
            <p className="px-5 py-10 text-center text-gray-400 text-sm">Tiada pesanan lagi</p>
          ) : (
            recentOrders.map((order: any) => {
              const sc = statusConfig[order.status] ?? { label: order.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
              const isUnpaid = order.payment_status === 'unpaid' && order.payment_method !== 'cod'
              return (
                <Link key={order.id} href={`/admin/orders/${order.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-red-600">{order.order_number}</span>
                      {isUnpaid && (
                        <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Belum Bayar</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 font-medium truncate">{order.profiles?.full_name ?? '—'}</p>
                    {order.profiles?.phone && (
                      <p className="text-xs text-gray-400">{order.profiles.phone}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sc.cls}`}>
                      {sc.label}
                    </span>
                    {order.delivery_slot && (
                      <span className="text-[10px] text-gray-400">🕐 {order.delivery_slot}</span>
                    )}
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <p className="font-bold text-gray-900 text-sm">RM{Number(order.total).toFixed(2)}</p>
                    <p className="text-[11px] text-gray-400">{timeAgo(order.created_at)}</p>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, sub, icon: Icon, gradient,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; gradient: string
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 overflow-hidden relative">
      <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${gradient} opacity-10 rounded-bl-3xl`} />
      <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${gradient} mb-3`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="text-2xl font-black text-gray-900 leading-none mb-1">{value}</p>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
