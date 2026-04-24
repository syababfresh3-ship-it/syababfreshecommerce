import { MobileHeader } from './mobile-header'
import { BottomNav } from './bottom-nav'
import { WhatsAppButton } from './whatsapp-button'

interface StoreLayoutProps {
  children: React.ReactNode
}

export function StoreLayout({ children }: StoreLayoutProps) {
  return (
    <>
      <MobileHeader />

      {/* Main content — padded for bottom nav + safe area */}
      <main className="flex-1 pb-24 w-full min-h-screen">
        {children}
      </main>

      <WhatsAppButton />
      <BottomNav />
    </>
  )
}
