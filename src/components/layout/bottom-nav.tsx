'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, ShoppingCart, User, ClipboardList } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/',         icon: Home,          label: 'Home' },
  { href: '/products', icon: Search,         label: 'Katalog' },
  { href: '/cart',     icon: ShoppingCart,   label: 'Troli' },
  { href: '/orders',   icon: ClipboardList,  label: 'Pesanan' },
  { href: '/profile',  icon: User,           label: 'Akaun' },
]

export function BottomNav() {
  const pathname = usePathname()
  const itemCount = useCartStore((state) => state.getItemCount())
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (pathname.startsWith('/admin')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative"
            >
              {/* Active pill background */}
              <div className={cn(
                'relative flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200',
                isActive ? 'bg-brand-red-50' : ''
              )}>
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-200',
                    isActive ? 'text-brand-red-600' : 'text-gray-400'
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />

                {/* Cart badge */}
                {item.href === '/cart' && mounted && itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-brand-red-600 text-white text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1 animate-bounce-in">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </div>

              <span className={cn(
                'text-[10px] transition-colors duration-200',
                isActive ? 'text-brand-red-600 font-semibold' : 'text-gray-400 font-medium'
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
