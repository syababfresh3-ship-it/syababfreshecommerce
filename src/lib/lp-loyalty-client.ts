'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export const LP_POINTS_RATE = 100 // 100 mata = RM1 (sama macam storefront)

// Hook: kesan sama ada pelawat LP dah login + baki mata mereka.
// Login-pilihan — guest checkout kekal; hanya yang login boleh tebus mata.
export function useLpLoyalty(): { loggedIn: boolean; points: number; loading: boolean } {
  const [state, setState] = useState<{ loggedIn: boolean; points: number; loading: boolean }>({
    loggedIn: false, points: 0, loading: true,
  })

  useEffect(() => {
    let active = true
    const supabase = createClient()
    ;(supabase.auth.getUser() as Promise<any>).then(({ data }: any) => {
      const user = data?.user
      if (!user) { if (active) setState({ loggedIn: false, points: 0, loading: false }); return }
      supabase.from('profiles').select('total_points').eq('id', user.id).single().then(({ data: p }: any) => {
        if (active) setState({ loggedIn: true, points: Number(p?.total_points ?? 0), loading: false })
      })
    })
    return () => { active = false }
  }, [])

  return state
}

// Kira diskaun mata: had kepada baki mata & jumlah belian (tak boleh lebih).
export function pointsDiscountFor(usePoints: boolean, points: number, capAmount: number): number {
  if (!usePoints) return 0
  return Math.min(points / LP_POINTS_RATE, Math.max(0, capAmount))
}
