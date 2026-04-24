'use client'

// conversion improvement: always-visible checkout nudge keeps buying momentum alive
import Link from 'next/link'
import { ShoppingBasket, ChevronRight } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { useEffect, useState } from 'react'

export function StickyCartBar() {
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.getTotal())
  const itemCount = useCartStore((s) => s.getItemCount())
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Don't render on server or when cart is empty
  if (!mounted || itemCount === 0) return null

  return (
    // Sits directly above the bottom nav (h-16 = 64px + safe area)
    <div
      className="fixed left-0 right-0 z-40 px-3 animate-slide-up"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div>
        <Link
          href="/cart"
          className="flex items-center justify-between bg-brand-fresh-600 text-white rounded-2xl px-4 py-3 shadow-xl shadow-brand-fresh-600/30 active:scale-[0.98] transition-transform"
        >
          {/* Left: basket icon + item count + total */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBasket className="h-5 w-5 opacity-90" />
              {/* conversion improvement: item count badge for glanceability */}
              <span className="absolute -top-2 -right-2.5 bg-white text-brand-fresh-700 text-[9px] font-extrabold rounded-full h-[14px] min-w-[14px] flex items-center justify-center px-0.5 leading-none">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-medium opacity-85">
                {itemCount} item dipilih
              </p>
              {/* conversion improvement: total price prominent so user sees value */}
              <p className="text-[15px] font-extrabold tracking-tight">
                RM{total.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-0.5 bg-white/15 rounded-xl px-3 py-1.5">
            <span className="text-sm font-bold">Checkout</span>
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </Link>
      </div>
    </div>
  )
}
