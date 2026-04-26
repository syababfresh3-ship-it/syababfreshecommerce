'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Package, ShoppingBag, Users, Boxes, Tag,
  BarChart2, Image, MapPin, ClipboardList, FolderOpen,
  LogOut, RotateCcw, Bell, ChevronRight, CreditCard, Truck, Megaphone, Route,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/lib/stores/cart'

const sections = [
  {
    label: 'OPERASI',
    items: [
      { href: '/admin/fulfillment',        label: 'Fulfillment',      icon: ClipboardList, badge: 'fulfillment' },
      { href: '/admin/orders',             label: 'Pesanan',          icon: ShoppingBag },
      { href: '/admin/inventory',          label: 'Inventori',        icon: Boxes },
      { href: '/admin/refunds',            label: 'Refund',           icon: RotateCcw,   badge: 'refunds' },
      { href: '/admin/shipping',           label: 'Penghantaran',     icon: Truck },
      { href: '/admin/lalamove-grouping',  label: 'Lalamove Groups',  icon: Route },
    ],
  },
  {
    label: 'KATALOG',
    items: [
      { href: '/admin/products',   label: 'Produk',    icon: Package },
      { href: '/admin/categories', label: 'Kategori',  icon: FolderOpen },
    ],
  },
  {
    label: 'PEMASARAN',
    items: [
      { href: '/admin/promos',         label: 'Promosi',    icon: Tag },
      { href: '/admin/banners',        label: 'Banner',     icon: Image },
      { href: '/admin/notifications',  label: 'Notifikasi', icon: Bell },
      { href: '/admin/marketing',      label: 'Tracking Iklan', icon: Megaphone },
    ],
  },
  {
    label: 'LAIN-LAIN',
    items: [
      { href: '/admin/customers', label: 'Pelanggan',     icon: Users },
      { href: '/admin/analytics', label: 'Analitik',      icon: BarChart2 },
      { href: '/admin/delivery',  label: 'Kawasan Hantar', icon: MapPin },
      { href: '/admin/payments',  label: 'Kaedah Bayar',  icon: CreditCard },
    ],
  },
]

type Counts = { fulfillment: number; refunds: number }

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const clearCart = useCartStore((s) => s.clearCart)
  const [counts, setCounts] = useState<Counts>({ fulfillment: 0, refunds: 0 })

  useEffect(() => {
    const supabase = createClient()

    async function fetchCounts() {
      const [ful, ref] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'confirmed', 'preparing', 'delivering']),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'cancelled')
          .eq('payment_status', 'paid'),
      ])
      setCounts({ fulfillment: ful.count ?? 0, refunds: ref.count ?? 0 })
    }

    fetchCounts()
    const iv = setInterval(fetchCounts, 30_000)
    return () => clearInterval(iv)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearCart()
    router.push('/login')
  }

  function getBadge(key?: string) {
    if (!key) return 0
    return counts[key as keyof Counts] ?? 0
  }

  return (
    <aside className="w-56 min-h-screen bg-gray-950 flex flex-col shrink-0">
      {/* Logo */}
      <Link href="/admin" className="px-5 py-4 border-b border-gray-800/60 block hover:bg-gray-900 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-red-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-black">S</span>
          </div>
          <div>
            <span className="text-white font-bold text-sm leading-none block">SyababFresh</span>
            <span className="text-gray-500 text-[10px] mt-0.5 block">Admin Panel</span>
          </div>
        </div>
      </Link>

      {/* Nav Sections */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {/* Dashboard — standalone */}
        <NavItem
          href="/admin"
          label="Dashboard"
          icon={LayoutDashboard}
          active={pathname === '/admin'}
        />

        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1 text-[10px] font-bold text-gray-600 tracking-widest uppercase">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href)
                const badge = getBadge(item.badge)
                return (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={active}
                    badge={badge}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 pt-2 border-t border-gray-800/60">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log Keluar
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  href, label, icon: Icon, active, badge,
}: {
  href: string; label: string; icon: React.ElementType
  active: boolean; badge?: number
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors group ${
        active
          ? 'bg-brand-red-600 text-white'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge && badge > 0 ? (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
          active ? 'bg-white/20 text-white' : 'bg-brand-red-600 text-white'
        }`}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : active ? (
        <ChevronRight className="h-3 w-3 opacity-60" />
      ) : null}
    </Link>
  )
}
