'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/lib/stores/cart'

// Penanda "kosongkan troli selepas bayaran berjaya".
//
// Sebelum ini checkout memanggil clearCart() SEBELUM redirect ke gateway CHIP —
// kalau bayaran gagal/dibatal, pelanggan balik ke /checkout dengan troli kosong.
// Kini checkout hanya tulis penanda (order id / order number) di sini, dan troli
// dikosongkan di page berjaya bila penanda sepadan dengan order yang dipapar.
//
// Guna localStorage (bukan sessionStorage) supaya penanda kekal walaupun
// gateway/bank app buka semula storefront dalam tab baharu — troli sendiri pun
// disimpan dalam localStorage (zustand persist), jadi skop yang sama.
export const PENDING_CLEAR_KEY = 'sf_pending_clear'

export function markPendingCartClear(orderKey: string) {
  try { localStorage.setItem(PENDING_CLEAR_KEY, orderKey) } catch {}
}

export function PendingCartClear({ orderKey }: { orderKey: string }) {
  const clearCart = useCartStore((s) => s.clearCart)

  useEffect(() => {
    try {
      const pending = localStorage.getItem(PENDING_CLEAR_KEY)
      if (!pending || pending !== orderKey) return
      localStorage.removeItem(PENDING_CLEAR_KEY)
      clearCart()
    } catch {}
  }, [orderKey, clearCart])

  return null
}
