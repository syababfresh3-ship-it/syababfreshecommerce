'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Package, ShoppingBag, Users, Boxes, Tag,
  BarChart2, Image, MapPin, ClipboardList, FolderOpen,
  LogOut, RotateCcw, Bell, ChevronRight, CreditCard, Truck, Megaphone, Gift, DollarSign, MessageSquare, MessageCircle, Settings2, Globe, Shield, BookOpen, Store, Send, Headset, Rocket, ScanLine, Inbox, Bot, Calculator, TrendingUp, BellRing, Star,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/lib/stores/cart'

const sections = [
  {
    label: 'CRM',
    items: [
      { href: '/admin/crm/inbox',    label: 'Inbox WhatsApp', icon: Inbox },
      { href: '/admin/crm/contacts', label: 'Contacts',       icon: Users },
      { href: '/admin/crm/blast',    label: 'Blast (Rasmi)',  icon: Megaphone },
      { href: '/admin/crm/templates', label: 'Templates',     icon: MessageCircle },
      { href: '/admin/crm/ai',       label: 'AI Chatbot',     icon: Bot },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      // Disorok 2026-06-17: team tak guna Fulfillment (urus order di Orders / syababfresh-app).
      // Page masih wujud — untuk pulihkan: nyahkomen baris bawah.
      // { href: '/admin/fulfillment',        label: 'Fulfillment',      icon: ClipboardList, badge: 'fulfillment' },
      { href: '/admin/quick-order',          label: 'Quick Order',     icon: MessageSquare },
      { href: '/admin/orders',             label: 'Orders',          icon: ShoppingBag },
      { href: '/admin/inventory',          label: 'Inventory',        icon: Boxes },
      { href: '/admin/refunds',            label: 'Refund',           icon: RotateCcw,   badge: 'refunds' },
      { href: '/admin/support',            label: 'Support AI',       icon: Headset },
      { href: '/admin/shipping',           label: 'Shipping',     icon: Truck },
      { href: '/admin/shipping/dispatch',  label: 'Scan Keluar',      icon: ScanLine },
      { href: '/admin/wa-outbox',          label: 'WA Outbox',        icon: Send },
      { href: '/admin/wa-blast',           label: 'WA Blast (ReplyLa)', icon: Rocket },
      // Disorok 2026-06-12: semua dispatch (Lalamove/Poslaju/Ninja) kini diuruskan di
      // syababfresh-app via raw export (/api/admin/orders-export). Page masih wujud —
      // untuk pulihkan: nyahkomen baris bawah + tambah balik `Route` ke import lucide.
      // { href: '/admin/lalamove-grouping',  label: 'Lalamove Groups',  icon: Route },
      { href: '/admin/sop',                label: 'Panduan SOP',      icon: BookOpen },
    ],
  },
  {
    label: 'CATALOG',
    items: [
      { href: '/admin/products',   label: 'Products',    icon: Package },
      { href: '/admin/categories', label: 'Categories',  icon: FolderOpen },
      { href: '/admin/reviews',    label: 'Reviews',     icon: Star },
    ],
  },
  {
    label: 'KEWANGAN',
    items: [
      { href: '/admin/pricing', label: 'Harga & Kos',  icon: Calculator },
      { href: '/admin/pnl',     label: 'P&L Website',  icon: TrendingUp },
    ],
  },
  {
    label: 'MARKETING',
    items: [
      { href: '/admin/promos',         label: 'Promotions',    icon: Tag },
      { href: '/admin/waitlist',       label: 'Waitlist',      icon: BellRing },
      { href: '/admin/promos/usage',   label: 'Kupon & Points', icon: BarChart2 },
      { href: '/admin/banners',        label: 'Banner',     icon: Image },
      { href: '/admin/notifications',  label: 'Notifications', icon: Bell },
      { href: '/admin/referrals',      label: 'Referrals',    icon: Gift },
      { href: '/admin/affiliates',     label: 'Affiliate',  icon: DollarSign },
      { href: '/admin/marketing',      label: 'Ad Tracking', icon: Megaphone },
      { href: '/admin/broadcast',       label: 'Broadcast WA',   icon: MessageSquare },
      { href: '/admin/landing-pages',  label: 'Landing Pages',  icon: Globe },
      { href: '/admin/media',          label: 'Media Library',  icon: Image },
      { href: '/admin/tiktok-sync',    label: 'TikTok Customers', icon: ShoppingBag },
    ],
  },
  {
    label: 'OTHER',
    items: [
      { href: '/admin/customers', label: 'Customers',     icon: Users },
      { href: '/admin/contacts',  label: 'All Contacts',  icon: Users },
      { href: '/admin/resellers', label: 'Reseller',      icon: Store },
      { href: '/admin/analytics', label: 'Analytics',      icon: BarChart2 },
      { href: '/admin/delivery',  label: 'Delivery Zones', icon: MapPin },
      { href: '/admin/payments',  label: 'Payment Methods',  icon: CreditCard },
      { href: '/admin/settings',  label: 'Store Settings',  icon: Settings2 },
      { href: '/admin/settings/whatsapp', label: 'WA Templates', icon: MessageCircle },
      { href: '/admin/team',      label: 'Pengguna Admin', icon: Shield },
    ],
  },
]

type Counts = { fulfillment: number; refunds: number }

export function AdminSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const clearCart = useCartStore((s) => s.clearCart)
  const [counts, setCounts] = useState<Counts>({ fulfillment: 0, refunds: 0 })

  // Close drawer when navigating on mobile
  useEffect(() => { onClose() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createClient()

    async function fetchCounts() {
      // Jangan poll bila tab tak aktif (admin selalu biar tab terbuka di latar) —
      // jimat beban DB (query count ni dulu 52% masa DB sebab poll terlalu kerap).
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const [ful, ref] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'confirmed', 'preparing', 'delivering']),
        supabase
          .from('refunds')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']),
      ])
      setCounts({ fulfillment: ful.count ?? 0, refunds: ref.count ?? 0 })
    }

    fetchCounts()
    const iv = setInterval(fetchCounts, 120_000) // 2 min (dulu 30s)
    const onVis = () => { if (document.visibilityState === 'visible') fetchCounts() } // segar semula bila balik ke tab
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
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
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-gray-950
      transform transition-transform duration-200 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      md:relative md:translate-x-0 md:w-56 md:min-h-screen md:shrink-0
    `.trim()}>
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
