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
    // Dedupe ikut order id (sessionStorage) — page berjaya boleh dimuat semula /
    // dilawati semula; pixel Purchase patut sekali sahaja setiap order.
    // Storage tak tersedia → jatuh ke ref sahaja.
    const key = `sf_purchase_${orderId}`
    try { if (sessionStorage.getItem(key)) { fired.current = true; return } } catch {}
    // Short delay so pixel scripts finish loading before we fire the event.
    // fired/sessionStorage ditanda DALAM timer: kalau effect dijalankan semula
    // (prop `items` = array baharu selepas router.refresh) sebelum 1.5s, timer
    // dibatalkan & dijadualkan semula — bukan hilang terus.
    const t = setTimeout(() => {
      if (fired.current) return
      fired.current = true
      try { sessionStorage.setItem(key, '1') } catch {}
      trackPurchase(orderId, total, items)
    }, 1500)
    return () => clearTimeout(t)
  }, [orderId, total, items])

  return null
}
