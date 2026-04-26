'use client'

import { useEffect, useRef } from 'react'
import { trackPurchase } from '@/lib/tracking'

interface Props {
  orderId: string
  total: number
  items: { product_name: string; unit_price: number; quantity: number }[]
}

export function PurchaseTracker({ orderId, total, items }: Props) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    // Short delay so pixel scripts finish loading before we fire the event
    const t = setTimeout(() => trackPurchase(orderId, total, items), 1500)
    return () => clearTimeout(t)
  }, [orderId, total, items])

  return null
}
