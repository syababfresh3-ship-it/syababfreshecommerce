'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingCart, Bell, ChevronLeft } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// Pages that show back button: title + where back goes
const backPages: Record<string, { title: string; back: string }> = {
  '/checkout':      { title: 'Checkout',       back: '/cart' },
  '/cart':          { title: 'Troli Saya',      back: '/products' },
  '/profile':       { title: 'Akaun Saya',      back: '/' },
  '/loyalty':       { title: 'Loyalty Points',  back: '/' },
  '/orders':        { title: 'Pesanan Saya',    back: '/' },
  '/notifications':  { title: 'Notifikasi',         back: '/' },
  '/affiliate':      { title: 'Dashboard Affiliate', back: '/profile' },
  '/jadi-affiliate': { title: 'Sertai Affiliate',    back: '/' },
  '/wishlist':       { title: 'Senarai Simpan',      back: '/profile' },
}

export function MobileHeader() {
  const pathname = usePathname()
  const itemCount = useCartStore((state) => state.getItemCount())
  const [mounted, setMounted] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const onScroll = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', onScroll, { passive: true })
    fetch('/api/logo').then(r => r.json()).then(d => setLogoUrl(d.logo_url ?? null)).catch(() => {})
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Hide on admin pages
  if (pathname.startsWith('/admin')) return null

  // Check if this is a detail/back page
  const backEntry = Object.entries(backPages).find(([p]) => pathname.startsWith(p))
  const isBackPage = !!backEntry
  const pageTitle = backEntry?.[1].title
  const backHref = backEntry?.[1].back ?? '/'

  return (
    <header className={cn(
      'sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b transition-shadow duration-200',
      scrolled ? 'border-gray-100 shadow-sm' : 'border-transparent'
    )}>
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Logo or Back */}
        {isBackPage ? (
          <Link href={backHref} className="flex items-center gap-1 text-gray-600">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm">{pageTitle}</span>
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="SyababFresh"
                width={120}
                height={36}
                className="h-9 w-auto object-contain"
                priority
              />
            ) : (
              <span className="text-xl font-bold text-gradient-brand">SyababFresh</span>
            )}
          </Link>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Link href="/notifications" className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors">
            <Bell className="h-5 w-5" />
          </Link>

          {/* Cart */}
          <Link
            href="/cart"
            className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ShoppingCart className="h-5 w-5" />
            {mounted && itemCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-brand-red-600 text-white text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
