import { MobileHeader } from './mobile-header'
import { BottomNav } from './bottom-nav'
import { WhatsAppButton } from './whatsapp-button'
import { CartSync } from '@/components/store/cart-sync'
import { createClient } from '@/lib/supabase/server'

interface StoreLayoutProps {
  children: React.ReactNode
}

async function getLogoUrl(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'store_logo_url')
      .maybeSingle()
    return data?.value || null
  } catch {
    return null
  }
}

export async function StoreLayout({ children }: StoreLayoutProps) {
  const logoUrl = await getLogoUrl()

  return (
    <>
      <CartSync />
      <MobileHeader logoUrl={logoUrl} />

      {/* Main content — padded for bottom nav + safe area */}
      <main className="flex-1 pb-24 w-full min-h-screen">
        {children}
      </main>

      <WhatsAppButton />
      <BottomNav />
    </>
  )
}
