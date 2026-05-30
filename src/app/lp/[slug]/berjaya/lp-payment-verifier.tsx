'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Fallback for LP guest FPX orders — pings CHIP on mount to confirm payment in case
// the server-to-server webhook hasn't landed. No UI; refreshes the page on confirm.
export function LpPaymentVerifier({ orderId }: { orderId: string }) {
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/lp/orders/${orderId}/verify-payment`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.justConfirmed) router.refresh()
      })
      .catch(() => {})
  }, [orderId, router])

  return null
}
