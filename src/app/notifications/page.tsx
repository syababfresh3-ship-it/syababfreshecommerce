// notification engagement optimized
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { StoreLayout } from '@/components/layout/store-layout'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  PackageCheck, Truck, ChevronRight, Bell,
  ShoppingBag, PackageX, RefreshCcw, Package,
} from 'lucide-react'

export const metadata: Metadata = { robots: { index: false, follow: false } }

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled' | 'refunded'

const statusConfig: Record<OrderStatus, {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  body: string
  priority: 'high' | 'normal'
}> = {
  delivering: {
    icon: Truck,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    title: 'Pesanan sedang dihantar',
    body: 'Rider sedang dalam perjalanan ke lokasi anda.',
    priority: 'high',
  },
  confirmed: {
    icon: PackageCheck,
    iconBg: 'bg-brand-red-50',
    iconColor: 'text-brand-red-600',
    title: 'Pesanan disahkan',
    body: 'Pesanan anda telah disahkan dan akan disediakan.',
    priority: 'high',
  },
  preparing: {
    icon: Package,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-500',
    title: 'Pesanan sedang disediakan',
    body: 'Pasukan kami sedang menyediakan produk segar anda.',
    priority: 'normal',
  },
  pending: {
    icon: ShoppingBag,
    iconBg: 'bg-yellow-50',
    iconColor: 'text-yellow-600',
    title: 'Pesanan diterima',
    body: 'Pesanan anda telah diterima dan menunggu pengesahan.',
    priority: 'normal',
  },
  delivered: {
    icon: PackageCheck,
    iconBg: 'bg-brand-red-50',
    iconColor: 'text-brand-red-600',
    title: 'Pesanan selesai',
    body: 'Produk segar anda telah sampai. Selamat menikmati!',
    priority: 'normal',
  },
  cancelled: {
    icon: PackageX,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    title: 'Pesanan dibatalkan',
    body: 'Pesanan anda telah dibatalkan.',
    priority: 'normal',
  },
  refunded: {
    icon: RefreshCcw,
    iconBg: 'bg-gray-50',
    iconColor: 'text-gray-500',
    title: 'Bayaran balik diproses',
    body: 'Bayaran balik untuk pesanan anda sedang diproses.',
    priority: 'normal',
  },
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'Baru sahaja'
  if (mins < 60) return `${mins} min lalu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs} jam lalu`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days} hari lalu`
  return new Date(dateStr).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/notifications')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, status, total, updated_at, created_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(30)

  const notifications = (orders ?? []).map((o) => ({
    ...o,
    config: statusConfig[o.status as OrderStatus] ?? statusConfig.pending,
  }))

  return (
    <StoreLayout>
      <div className="bg-gray-50 min-h-screen px-4 pt-5 pb-28">
        <h1 className="text-lg font-bold text-gray-900 mb-5">Notifikasi</h1>

        {notifications.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-gray-100 scale-[1.3] blur-lg" />
              <div className="relative w-16 h-16 rounded-full bg-white shadow-[0_2px_14px_rgba(0,0,0,0.07)] flex items-center justify-center">
                <Bell className="h-7 w-7 text-gray-300" />
              </div>
            </div>
            <p className="text-[15px] font-bold text-gray-700 mb-2">Tiada notifikasi lagi</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Kami akan maklumkan update pesanan anda di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n) => {
              const Icon = n.config.icon
              const isHigh = n.config.priority === 'high'

              return (
                <Link
                  key={n.id}
                  href={`/orders/${n.id}`}
                  className={`flex items-start gap-3.5 rounded-2xl p-4 transition-all duration-150 active:scale-[0.98] ${
                    isHigh
                      ? 'bg-white shadow-[0_2px_14px_rgba(0,0,0,0.08)] border border-gray-100/80'
                      : 'bg-white shadow-[0_1px_8px_rgba(0,0,0,0.05)] border border-gray-100/60'
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl ${n.config.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`h-5 w-5 ${n.config.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[13px] leading-snug ${isHigh ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                        {n.config.title}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 tabular-nums">
                        {relativeTime(n.updated_at ?? n.created_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">
                      {n.config.body}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono mt-1.5">
                      {n.order_number}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 mt-3" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </StoreLayout>
  )
}
