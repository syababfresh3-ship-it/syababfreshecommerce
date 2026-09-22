'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Package, ShoppingBag, Users, Tag,
  BarChart2, Image, MapPin, FolderOpen,
  LogOut, RotateCcw, ChevronRight, ChevronDown, CreditCard, Truck, Megaphone, MessageSquare, MessageCircle, Settings2, Globe, Shield, BookOpen, Store, Send, Inbox, Bot, Calculator, TrendingUp, BellRing, Star, Database, PanelTop,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/lib/stores/cart'

type NavEntry = { href: string; label: string; icon: React.ElementType; badge?: keyof Counts }
type Section = { label: string; items: NavEntry[]; collapsible?: boolean }

// Disorok dari nav 2026-09-23 (page masih wujud — boleh dibuka terus via URL).
// Bukti: tarikh tulis terakhir jadual DB di belakang setiap page.
//   /admin/customers          Customers          → ahli berdaftar sahaja; Customer Database cover semua
//   /admin/contacts           All Contacts       → jadual customers + Broadcast Murpati (0 hantaran)
//   /admin/broadcast          Broadcast WA       → Murpati, 0 hantaran direkod; guna Blast (Rasmi)
//   /admin/wa-blast           WA Blast (ReplyLa) → tracking WA kini dihantar dari syababfresh-app
//   /admin/shipping/dispatch  Scan Keluar        → 1 scan sahaja (8 Jun); dispatch di syababfresh-app
//   /admin/notifications      Notifications      → push, 13 pelanggan langgan, terakhir 18 Ogos
//   /admin/referrals          Referrals          → 1 rekod (Jul)
//   /admin/affiliates         Affiliate          → 0 komisen, 0 pengeluaran
//   /admin/support            Support AI         → 3 aduan, terakhir 5 Jun
//   /admin/inventory          Inventory          → batch stok terakhir 7 Mei
//   /admin/marketing/ads      Ad Spend & ROAS    → jadual ad_spend kosong
// Untuk pulihkan: tambah semula ke kumpulan berkaitan + import ikon lucide
// (Bell, Boxes, DollarSign, Gift, Headset, Rocket, ScanLine).
const sections: Section[] = [
  {
    label: 'CRM',
    items: [
      { href: '/admin/crm/inbox',     label: 'Inbox WhatsApp',    icon: Inbox },
      { href: '/admin/crm/contacts',  label: 'Contacts',          icon: Users },
      { href: '/admin/database',      label: 'Customer Database', icon: Database },
      { href: '/admin/crm/blast',     label: 'Blast (Rasmi)',     icon: Megaphone },
      { href: '/admin/crm/templates', label: 'Templates',         icon: MessageCircle },
      { href: '/admin/crm/ai',        label: 'AI Chatbot',        icon: Bot },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      // Disorok 2026-06-17: team tak guna Fulfillment (urus order di Orders / syababfresh-app).
      // Page masih wujud — untuk pulihkan: nyahkomen baris bawah + tambah balik `ClipboardList` ke import lucide.
      // { href: '/admin/fulfillment',        label: 'Fulfillment',      icon: ClipboardList, badge: 'fulfillment' },
      { href: '/admin/quick-order', label: 'Quick Order', icon: MessageSquare },
      { href: '/admin/orders',      label: 'Orders',      icon: ShoppingBag },
      { href: '/admin/shipping',    label: 'Shipping',    icon: Truck },
      { href: '/admin/refunds',     label: 'Refund',      icon: RotateCcw, badge: 'refunds' },
      { href: '/admin/wa-outbox',   label: 'WA Outbox',   icon: Send },
      // Disorok 2026-06-12: semua dispatch (Lalamove/Poslaju/Ninja) kini diuruskan di
      // syababfresh-app via raw export (/api/admin/orders-export). Page masih wujud —
      // untuk pulihkan: nyahkomen baris bawah + tambah balik `Route` ke import lucide.
      // { href: '/admin/lalamove-grouping',  label: 'Lalamove Groups',  icon: Route },
    ],
  },
  {
    label: 'CATALOG',
    items: [
      { href: '/admin/products',      label: 'Products',      icon: Package },
      { href: '/admin/categories',    label: 'Categories',    icon: FolderOpen },
      { href: '/admin/reviews',       label: 'Reviews',       icon: Star },
      { href: '/admin/media',         label: 'Media Library', icon: Image },
      { href: '/admin/landing-pages', label: 'Landing Pages', icon: Globe },
      { href: '/admin/banners',       label: 'Banner',        icon: PanelTop },
    ],
  },
  {
    label: 'MARKETING',
    items: [
      { href: '/admin/promos',       label: 'Promotions',     icon: Tag },
      { href: '/admin/promos/usage', label: 'Kupon & Points', icon: BarChart2 },
      { href: '/admin/waitlist',     label: 'Waitlist',       icon: BellRing },
    ],
  },
  {
    label: 'KEWANGAN',
    items: [
      { href: '/admin/pricing',   label: 'Harga & Kos', icon: Calculator },
      { href: '/admin/pnl',       label: 'P&L Website', icon: TrendingUp },
      { href: '/admin/analytics', label: 'Analytics',   icon: BarChart2 },
    ],
  },
  {
    // Tetapan yang jarang disentuh — kumpulan ini lipat (collapsed) secara lalai,
    // terbuka automatik bila salah satu page di dalamnya sedang dibuka.
    label: 'SETTINGS',
    collapsible: true,
    items: [
      { href: '/admin/settings',          label: 'Store Settings',   icon: Settings2 },
      { href: '/admin/payments',          label: 'Payment Methods',  icon: CreditCard },
      { href: '/admin/delivery',          label: 'Delivery Zones',   icon: MapPin },
      { href: '/admin/team',              label: 'Pengguna Admin',   icon: Shield },
      { href: '/admin/sop',               label: 'Panduan SOP',      icon: BookOpen },
      { href: '/admin/marketing',         label: 'Ad Tracking',      icon: Megaphone },
      { href: '/admin/settings/whatsapp', label: 'WA Templates',     icon: MessageCircle },
      { href: '/admin/resellers',         label: 'Reseller',         icon: Store },
      { href: '/admin/tiktok-sync',       label: 'TikTok Customers', icon: ShoppingBag },
    ],
  },
]

type Counts = { fulfillment: number; refunds: number }

export function AdminSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const clearCart = useCartStore((s) => s.clearCart)
  const [counts, setCounts] = useState<Counts>({ fulfillment: 0, refunds: 0 })
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Satu item sahaja aktif: padanan href paling panjang (dulu '/admin/settings' dan
  // '/admin/settings/whatsapp' menyala serentak sebab startsWith).
  const activeHref = sections
    .flatMap((s) => s.items.map((i) => i.href))
    .filter((h) => pathname === h || pathname.startsWith(h + '/'))
    .sort((a, b) => b.length - a.length)[0]

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

  function getBadge(key?: keyof Counts) {
    if (!key) return 0
    return counts[key] ?? 0
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

        {sections.map((section) => {
          const inside = section.items.some((i) => i.href === activeHref)
          const open = !section.collapsible || (openGroups[section.label] ?? inside)
          return (
            <div key={section.label}>
              {section.collapsible ? (
                <button
                  type="button"
                  onClick={() => setOpenGroups((g) => ({ ...g, [section.label]: !open }))}
                  className="w-full flex items-center justify-between px-2 mb-1 text-[10px] font-bold text-gray-600 tracking-widest uppercase hover:text-gray-400 transition-colors"
                >
                  {section.label}
                  <ChevronDown className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} />
                </button>
              ) : (
                <p className="px-2 mb-1 text-[10px] font-bold text-gray-600 tracking-widest uppercase">
                  {section.label}
                </p>
              )}
              {open && (
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={item.href === activeHref}
                      badge={getBadge(item.badge)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
