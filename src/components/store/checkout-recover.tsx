'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCartStore } from '@/lib/stores/cart'
import type { Product, ProductVariant } from '@/types'

// Sprint 3F: pulihkan troli dari pautan email peringatan (/checkout?recover=<token>).
//
// GET /api/store/checkout-session?token=… pulangkan item (produk/varian aktif
// sahaja, baris penuh) + nama/email/telefon. Item dimasukkan ke zustand cart
// melalui addItem (item yang sudah ada dalam troli dikekalkan — tak digandakan,
// sama seperti CartSync). Kemudian ?recover dibuang dari URL dan ibu bapa
// diberitahu (onRestored) untuk prefill medan + papar notis.
//
// Dipasang dalam DUA cabang page checkout (troli kosong & borang) — komponen
// ini akan remount bila cabang bertukar selepas item masuk. Penjaga
// sessionStorage (per token) pastikan pemulihan jalan SEKALI sahaja, termasuk
// double-invoke effect React StrictMode (dev). Pemanggil bungkus dalam
// <Suspense> (useSearchParams).
export type RecoveredInfo = {
  name: string | null
  email: string | null
  phone: string | null
  count: number   // item dalam sesi yang masih tersedia
  skipped: number // item tidak lagi tersedia (produk/varian tidak aktif)
}

type RecoveredItem = { product: Product; variant: ProductVariant | null; quantity: number }

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/

export function CheckoutRecover({ onRestored }: { onRestored: (info: RecoveredInfo) => void }) {
  const sp = useSearchParams()
  const token = sp.get('recover')
  // Corak "latest ref": kemas kini dalam effect (bukan semasa render) supaya
  // effect pemulihan di bawah tak perlu bergantung pada identiti callback.
  const cbRef = useRef(onRestored)
  useEffect(() => { cbRef.current = onRestored })

  useEffect(() => {
    if (!token || !TOKEN_RE.test(token)) return
    const key = `sf_recovered_${token}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {}

    fetch(`/api/store/checkout-session?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ok?: boolean; name?: string | null; email?: string | null; phone?: string | null; items?: RecoveredItem[]; skipped?: number } | null) => {
        if (!d?.ok) {
          try { sessionStorage.removeItem(key) } catch {} // benarkan cuba semula (refresh)
          return
        }
        const store = useCartStore.getState()
        const items = Array.isArray(d.items) ? d.items : []
        for (const it of items) {
          if (!it?.product?.id) continue
          const vid = it.variant?.id ?? null
          const exists = store.items.find((i) => i.product.id === it.product.id && (i.variant?.id ?? null) === vid)
          if (exists) continue
          store.addItem(it.product, Math.max(1, Number(it.quantity) || 1), it.variant ?? null)
        }
        try { window.history.replaceState(null, '', '/checkout') } catch {}
        cbRef.current({
          name: d.name ?? null,
          email: d.email ?? null,
          phone: d.phone ?? null,
          count: items.length,
          skipped: Number(d.skipped ?? 0),
        })
      })
      .catch(() => { try { sessionStorage.removeItem(key) } catch {} })
  }, [token])

  return null
}
