export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag, Star, MapPin, Mail, Phone, Crown, Leaf, Calendar, TrendingUp, Clock } from 'lucide-react'
import { LoyaltyAdjust } from '../loyalty-adjust'
import { getSegment, SEGMENT_CONFIG } from '../segment-utils'

async function getCustomer(id: string) {
  const supabase = createClient()

  const [profileRes, ordersRes, addressesRes, loyaltyRes] = await Promise.all([
    supabase.from('profiles').select('*, loyalty_tiers(name, multiplier)').eq('id', id).single(),
    supabase.from('orders').select('id, order_number, status, total, payment_status, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
    supabase.from('addresses').select('*').eq('user_id', id).order('is_default', { ascending: false }),
    supabase.from('loyalty_transactions').select('id, points, type, description, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(30),
  ])

  if (!profileRes.data) return null

  // Fetch LP orders matched by phone
  let lpOrders: any[] = []
  if (profileRes.data.phone) {
    const phone = profileRes.data.phone
    const normalized = phone.replace(/\D/g, '').replace(/^0/, '6').replace(/^(?!60)/, '60')
    const variants = [phone, normalized, phone.replace(/^0/, ''), '0' + normalized.slice(2)]
    const { data: lpRes } = await supabase
      .from('lp_guest_orders')
      .select('id, order_number, status, total, payment_method, created_at, items, product_name, variant_name, quantity, unit_price, landing_pages(title, slug)')
      .in('phone', [...new Set(variants)])
      .order('created_at', { ascending: false })
    lpOrders = lpRes ?? []
  }

  return {
    profile: profileRes.data,
    orders: ordersRes.data ?? [],
    addresses: addressesRes.data ?? [],
    loyaltyTx: loyaltyRes.data ?? [],
    lpOrders,
  }
}

const statusStyles: Record<string, string> = {
  pending:    'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed:  'bg-blue-50 text-blue-700 border-blue-200',
  preparing:  'bg-purple-50 text-purple-700 border-purple-200',
  delivering: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered:  'bg-green-50 text-green-700 border-green-200',
  cancelled:  'bg-red-50 text-red-700 border-red-200',
  refunded:   'bg-gray-50 text-gray-600 border-gray-200',
}

const statusLabel: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  delivering: 'Shipped', delivered: 'Selesai', cancelled: 'Cancelled', refunded: 'Refunded',
}

const TIER_CONFIG: Record<string, { cls: string; icon: typeof Leaf }> = {
  'Hijau':    { cls: 'bg-green-50 text-green-700 border-green-200',    icon: Leaf },
  'Emas':     { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Star },
  'Platinum': { cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: Crown },
}

const TX_TYPE_CONFIG: Record<string, { label: string; cls: string; sign: string }> = {
  earn:       { label: 'Earned',  cls: 'text-green-600',  sign: '+' },
  redeem:     { label: 'Redeemed',    cls: 'text-orange-600', sign: '-' },
  adjustment: { label: 'Adjusted',      cls: 'text-blue-600',   sign: '' },
  expire:     { label: 'Expired',      cls: 'text-red-500',    sign: '-' },
}

const AVATAR_COLORS = [
  'bg-red-100 text-red-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600',
  'bg-orange-100 text-orange-600', 'bg-purple-100 text-purple-600', 'bg-teal-100 text-teal-600',
]
function avatarColor(id: string) {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getCustomer(id)
  if (!data) notFound()

  const { profile, orders, addresses, loyaltyTx, lpOrders } = data
  const tierName = (profile.loyalty_tiers as any)?.name ?? 'Hijau'
  const multiplier = (profile.loyalty_tiers as any)?.multiplier ?? 1
  const completedOrders = orders.filter((o: any) => o.status === 'delivered')
  const totalOrders = orders.length
  const tierConfig = TIER_CONFIG[tierName] ?? TIER_CONFIG['Hijau']
  const TierIcon = tierConfig.icon
  const initials = (profile.full_name ?? '?').charAt(0).toUpperCase()

  // Metrics
  const deliveredOrders = orders.filter((o: any) => ['confirmed', 'preparing', 'delivering', 'delivered'].includes(o.status))
  const lastOrderAt = orders[0]?.created_at ?? null
  const avgOrderValue = completedOrders.length > 0
    ? completedOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0) / completedOrders.length
    : null
  const daysSinceJoin = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000)
  const orderFreq = deliveredOrders.length > 0 && daysSinceJoin > 0
    ? (deliveredOrders.length / (daysSinceJoin / 30)).toFixed(1)
    : null

  const segment = getSegment({
    totalSpend: Number(profile.total_spend ?? 0),
    createdAt: profile.created_at,
    lastOrderAt,
    orderCount: deliveredOrders.length,
  })
  const segCfg = SEGMENT_CONFIG[segment]

  return (
    <div className="p-4 md:p-6">
      {/* Back + header */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Link href="/admin/customers" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${avatarColor(id)}`}>
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{profile.full_name ?? 'No Name'}</h1>
          <p className="text-xs text-gray-400">{profile.email ?? '—'}</p>
        </div>
        <span className={`ml-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${tierConfig.cls}`}>
          <TierIcon className="h-3 w-3" />
          Tier {tierName}
        </span>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${segCfg.color}`}>
          {segCfg.emoji} {segCfg.label}
        </span>
      </div>

      {/* Metrics bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingBag className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Orders</span>
          </div>
          <span className="text-xl font-black text-gray-900">{deliveredOrders.length}</span>
          <span className="text-xs text-gray-400 ml-1">/ {totalOrders} total</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Avg Orders</span>
          </div>
          <span className="text-xl font-black text-gray-900">
            {avgOrderValue !== null ? `RM${avgOrderValue.toFixed(0)}` : '—'}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Last Order</span>
          </div>
          <span className="text-sm font-bold text-gray-900">
            {lastOrderAt
              ? new Date(lastOrderAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">Frequency</span>
          </div>
          <span className="text-xl font-black text-gray-900">
            {orderFreq ?? '—'}
          </span>
          {orderFreq && <span className="text-xs text-gray-400 ml-1">orders/bulan</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Profile info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Details</h2>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-700 truncate text-xs">{profile.email ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-700 text-xs">{profile.phone ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-700 text-xs">
                  Registered {new Date(profile.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <span className="text-gray-400"> · {daysSinceJoin} hari lepas</span>
                </span>
              </div>
            </div>
          </div>

          {/* Loyalty stats */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Loyalty</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Points earned</span>
                <span className="text-sm font-bold text-gray-900">{(profile.total_points ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Total spend</span>
                <span className="text-sm font-bold text-gray-900">RM{Number(profile.total_spend ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Multiplier</span>
                <span className="text-sm font-bold text-amber-600">{multiplier}x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Completed orders</span>
                <span className="text-sm font-bold text-gray-900">{completedOrders.length} / {totalOrders}</span>
              </div>
            </div>
          </div>

          {/* Loyalty adjustment */}
          <LoyaltyAdjust userId={id} currentPoints={profile.total_points ?? 0} />

          {/* Loyalty transactions */}
          {loyaltyTx.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-400" /> Points History
              </h2>
              <div className="space-y-2">
                {loyaltyTx.map((tx: any) => {
                  const cfg = TX_TYPE_CONFIG[tx.type] ?? { label: tx.type, cls: 'text-gray-600', sign: '' }
                  const sign = tx.points > 0 ? '+' : ''
                  return (
                    <div key={tx.id} className="flex items-start justify-between gap-2 py-2 border-b border-gray-50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{tx.description}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(tx.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                          <span className={`ml-2 font-semibold ${cfg.cls}`}>{cfg.label}</span>
                        </p>
                      </div>
                      <span className={`text-sm font-black shrink-0 ${tx.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {sign}{tx.points}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Addresses */}
          {addresses.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-400" /> Address
              </h2>
              <div className="space-y-3">
                {addresses.map((addr: any) => (
                  <div key={addr.id} className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-gray-800">{addr.label}</span>
                      {addr.is_default && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Default</span>}
                    </div>
                    <p className="text-gray-500">{addr.full_address}</p>
                    {(addr.postcode || addr.city) && (
                      <p className="text-gray-500">{[addr.postcode, addr.city, addr.state].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Orders */}
        <div className="lg:col-span-2 space-y-4">
          {/* LP Orders */}
          {lpOrders.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm">
              <div className="px-5 py-4 border-b border-rose-100 flex items-center gap-2 bg-rose-50 rounded-t-2xl">
                <span className="text-base">📄</span>
                <h2 className="font-bold text-gray-900">Landing Page Orders</h2>
                <span className="ml-auto text-xs text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full font-semibold">{lpOrders.length} orders</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lpOrders.map((o: any) => {
                      const items: any[] = Array.isArray(o.items) && o.items.length > 0 ? o.items : [{ product_name: o.product_name, variant_name: o.variant_name, quantity: o.quantity }]
                      return (
                        <tr key={o.id} className="hover:bg-gray-50/80">
                          <td className="px-5 py-3">
                            <p className="font-mono text-xs text-rose-600 font-semibold">{o.order_number}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {items.map((i: any) => `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} ×${i.quantity}`).join(', ')}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-500">{(o.landing_pages as any)?.title ?? '—'}</td>
                          <td className="px-5 py-3 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              o.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                              o.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
                              'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}>{o.status}</span>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-gray-900">RM{Number(o.total).toFixed(2)}</td>
                          <td className="px-5 py-3 text-right text-xs text-gray-400">
                            {new Date(o.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-gray-400" />
              <h2 className="font-bold text-gray-900">Order History</h2>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{totalOrders} orders</span>
            </div>

            {orders.length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-400 text-sm">
                <ShoppingBag className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                No orders yet
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Orders</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/admin/orders/${order.id}`}
                          className="font-mono text-xs text-red-600 hover:underline font-semibold">
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusStyles[order.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {statusLabel[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs font-semibold ${order.payment_status === 'paid' ? 'text-green-600' : 'text-gray-400'}`}>
                          {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900">
                        RM{Number(order.total).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-400 text-xs">
                        {new Date(order.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
