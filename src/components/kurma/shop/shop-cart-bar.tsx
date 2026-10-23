'use client'

// Bar troli melekat bawah untuk /shop kurma — muncul bila troli ada item. Pautan relatif /cart &
// /checkout = hos semasa (hos kurma: proxy lalukan terus) supaya troli (localStorage ikut origin)
// dan checkout berada di hos yang sama. `mounted` elak hydration mismatch (troli dari localStorage).
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ShoppingCart, ChevronRight } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { rm2 } from '@/lib/kurma-shop'

export function ShopCartBar() {
  const items = useCartStore(s => s.items)
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const count = items.reduce((n, i) => n + i.quantity, 0)
  const total = items.reduce((t, i) => t + Number(i.variant?.price ?? i.product.price) * i.quantity, 0)
  if (!mounted || count === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} role="region" aria-label="Troli">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 leading-none">{count} item dalam troli</p>
          <p className="text-[17px] font-black text-gray-900 leading-tight tabular-nums">{rm2(total)}</p>
          <p className="text-[10px] text-gray-400 leading-none mt-0.5">+ penghantaran dikira di checkout</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/cart" className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl text-[13px] font-bold text-gray-800 border border-gray-200 hover:border-gray-400">
            <ShoppingCart className="h-4 w-4" /> Troli
          </Link>
          <Link href="/checkout" className="inline-flex items-center gap-1 h-11 px-4 rounded-xl text-[14px] font-bold text-white" style={{ background: '#E11D2A' }}>
            Bayar sekarang <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
