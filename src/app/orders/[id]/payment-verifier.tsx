'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function PaymentVerifier({ orderId }: { orderId: string }) {
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/orders/${orderId}/verify-payment`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.justConfirmed) router.refresh()
      })
      .catch(() => {})
  }, [orderId, router])

  return null
}
