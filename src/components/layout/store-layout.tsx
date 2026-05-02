import { LogoHeader } from './logo-header'
import { BottomNav } from './bottom-nav'
import { WhatsAppButton } from './whatsapp-button'
import { CartSync } from '@/components/store/cart-sync'

interface StoreLayoutProps {
  children: React.ReactNode
}

export function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <>
      <CartSync />
      <LogoHeader />

      {/* Main content — padded for bottom nav + safe area */}
      <main className="flex-1 pb-24 w-full min-h-screen">
        {children}
      </main>

      <WhatsAppButton />
      <BottomNav />
    </>
  )
}
