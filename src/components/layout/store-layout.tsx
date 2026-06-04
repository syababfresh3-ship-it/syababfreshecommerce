import { MobileHeader } from './mobile-header'
import { BottomNav } from './bottom-nav'
import { SupportButton } from './support-button'
import { CartSync } from '@/components/store/cart-sync'

interface StoreLayoutProps {
  children: React.ReactNode
}

export function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <>
      <CartSync />
      <MobileHeader />

      {/* Main content — padded for bottom nav + safe area */}
      <main className="flex-1 pb-24 w-full min-h-screen">
        {children}
      </main>

      <SupportButton />
      <BottomNav />
    </>
  )
}
