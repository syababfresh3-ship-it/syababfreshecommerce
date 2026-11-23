'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Fallback for LP guest FPX orders — pings CHIP on mount to confirm payment in case
// the server-to-server webhook hasn't landed. No UI; refreshes the page once confirmed.
export function LpPaymentVerifier({ orderId }: { orderId: string }) {
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/lp/orders/${orderId}/verify-payment`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        // Refresh bila sudah disahkan (oleh kita ATAU webhook yang mendahului) supaya page
        // render semula dalam keadaan dibayar → Purchase pixel ditembak sekali (migration 167).
        if (data.justConfirmed || data.status === 'confirmed') router.refresh()
      })
      .catch(() => {})
  }, [orderId, router])

  return null
}
