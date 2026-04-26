export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingBag, Star, MapPin, Mail, Phone, Crown, Leaf, Calendar } from 'lucide-react'
import { LoyaltyAdjust } from '../loyalty-adjust'

async function getCustomer(id: string) {
  const supabase = createClient()

  const [profileRes, ordersRes, addressesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, loyalty_tiers(name, multiplier)')
      .eq('id', id)
      .single(),
    supabase
      .from('orders')
      .select('id, order_number, status, total, payment_status, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('addresses')
      .select('*')
      .eq('user_id', id)
      .order('is_default', { ascending: false }),
  ])

  if (!profileRes.data) return null

  return {
    profile: profileRes.data,
    orders: ordersRes.data ?? [],
    addresses: addressesRes.data ?? [],
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
  pending: 'Menunggu', confirmed: 'Disahkan', preparing: 'Disediakan',
  delivering: 'Dihantar', delivered: 'Selesai', cancelled: 'Dibatal', refunded: 'Dibayar Balik',
}

const TIER_CONFIG: Record<string, { cls: string; icon: typeof Leaf }> = {
  'Hijau':    { cls: 'bg-green-50 text-green-700 border-green-200',    icon: Leaf },
  'Emas':     { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Star },
  'Platinum': { cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: Crown },
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

  const { profile, orders, addresses } = data
  const tierName = (profile.loyalty_tiers as any)?.name ?? 'Hijau'
  const multiplier = (profile.loyalty_tiers as any)?.multiplier ?? 1
  const totalOrders = orders.length
  const completedOrders = orders.filter((o: any) => o.status === 'delivered').length
  const tierConfig = TIER_CONFIG[tierName] ?? TIER_CONFIG['Hijau']
  const TierIcon = tierConfig.icon
  const initials = (profile.full_name ?? '?').charAt(0).toUpperCase()

  return (
    <div className="p-6 max-w-5xl">
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/customers" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${avatarColor(id)}`}>
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{profile.full_name ?? 'Tanpa Nama'}</h1>
          <p className="text-xs text-gray-400">{profile.email ?? '—'}</p>
        </div>
        <span className={`ml-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${tierConfig.cls}`}>
          <TierIcon className="h-3 w-3" />
          Tier {tierName}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left column */}
        <div className="col-span-1 space-y-4">
          {/* Profile info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Maklumat</h2>
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
                <span className="text-gray-700 text-xs">Daftar {new Date(profile.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* Loyalty stats */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Loyalty</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Mata terkumpul</span>
                <span className="text-sm font-bold text-gray-900">{(profile.total_points ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Jumlah belanja</span>
                <span className="text-sm font-bold text-gray-900">RM{Number(profile.total_spend ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Multiplier</span>
                <span className="text-sm font-bold text-amber-600">{multiplier}x</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Pesanan selesai</span>
                <span className="text-sm font-bold text-gray-900">{completedOrders} / {totalOrders}</span>
              </div>
            </div>
          </div>

          {/* Loyalty adjustment */}
          <LoyaltyAdjust userId={id} currentPoints={profile.total_points ?? 0} />

          {/* Addresses */}
          {addresses.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-400" /> Alamat
              </h2>
              <div className="space-y-3">
                {addresses.map((addr: any) => (
                  <div key={addr.id} className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-gray-800">{addr.label}</span>
                      {addr.is_default && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Utama</span>}
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
        <div className="col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-gray-400" />
              <h2 className="font-bold text-gray-900">Sejarah Pesanan</h2>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{totalOrders} pesanan</span>
            </div>

            {orders.length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-400 text-sm">
                <ShoppingBag className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                Tiada pesanan lagi
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">No. Pesanan</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Bayaran</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarikh</th>
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
                          {order.payment_status === 'paid' ? 'Dibayar' : 'Belum Bayar'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900">
                        RM{Number(order.total).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-400 text-xs">
                        {new Date(order.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
