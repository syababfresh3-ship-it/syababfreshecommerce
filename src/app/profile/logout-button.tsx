'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    // account page polish: logout is destructive-secondary — muted border, red text on hover
    <button
      onClick={handleLogout}
      // account page final polish: borderless, shadow-only — lowest visual weight on the page
      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white text-sm font-medium text-gray-400 shadow-[0_1px_6px_rgba(0,0,0,0.05)] hover:text-red-500 hover:bg-red-50/50 active:scale-[0.97] transition-all duration-150"
    >
      <LogOut className="h-4 w-4" />
      Log Keluar
    </button>
  )
}
