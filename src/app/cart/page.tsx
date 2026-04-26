'use client'

import { useCartStore } from '@/lib/stores/cart'
import { StoreLayout } from '@/components/layout/store-layout'
import Link from 'next/link'
import Image from 'next/image'
import { Minus, Plus, Trash2, ShoppingBag, ShieldCheck, Truck, AlertTriangle, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CartPage() {
  const { items, updateQuantity, removeItem, getTotal } = useCartStore()
  const total = getTotal()
  const [liveStock, setLiveStock] = useState<Record<string, number>>({})

  useEffect(() => {
    if (items.length === 0) return
    const ids = items.map((i) => i.product.id)
    const supabase = createClient()
    supabase
      .from('product_stock')
      .select('product_id, available_stock')
      .in('product_id', ids)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, number> = {}
        data.forEach((r) => { map[r.product_id] = r.available_stock })
        setLiveStock(map)
      })
  }, [items.length])

  if (items.length === 0) {
    return (
      <StoreLayout>
        {/* checkout polish: empty state — calm, inviting, not harsh */}
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
            <ShoppingBag className="h-9 w-9 text-gray-300" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1.5">Troli masih kosong</h2>
          <p className="text-sm text-gray-400 mb-7 leading-relaxed">Tambah buah segar ke troli untuk meneruskan</p>
          <Link
            href="/products"
            className="bg-brand-fresh-500 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(34,197,94,0.35)] active:scale-95 transition-transform"
          >
            Lihat Produk
          </Link>
        </div>
      </StoreLayout>
    )
  }

  const hasStockIssue = items.some(({ product, quantity }) => {
    const s = liveStock[product.id]
    return s !== undefined && quantity > s
  })

  // cart page safe conversion polish
  return (
    <StoreLayout>
      <div className="px-4 pt-4 pb-52">
        <h1 className="text-lg font-bold text-gray-900 mb-4">Troli Saya</h1>

        <div className="space-y-3.5">
          {items.map(({ product, variant, quantity }) => {
            const unitPrice = variant ? Number(variant.price) : Number(product.price)
            const availStock = variant ? variant.stock : liveStock[product.id]
            const isOutOfStock = availStock !== undefined && availStock === 0
            const exceedsStock = availStock !== undefined && quantity > availStock
            const itemKey = `${product.id}-${variant?.id ?? ''}`

            return (
              <div
                key={itemKey}
                className={`bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.08)] p-4 flex gap-3.5 ${
                  isOutOfStock ? 'ring-1 ring-red-200 bg-red-50/50' :
                  exceedsStock  ? 'ring-1 ring-yellow-200 bg-yellow-50/50' : ''
                }`}
              >
                {/* thumbnail — warm bg, tighter fill */}
                <div className="w-[88px] h-[88px] rounded-2xl bg-gradient-to-b from-[#fdf8f2] to-[#f0e8dc] overflow-hidden relative shrink-0">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover scale-[1.22]"
                      sizes="88px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">🍓</div>
                  )}
                </div>

                {/* Info column */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-semibold text-gray-900 line-clamp-2 leading-snug">
                    {product.name}
                    {variant && (
                      <span className="ml-1 text-[11px] font-normal text-gray-400">({variant.name})</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">
                    RM{unitPrice.toFixed(2)}{!variant ? ` / ${product.unit}` : ''}
                  </p>

                  {/* Stock warnings */}
                  {isOutOfStock && (
                    <p className="flex items-center gap-1 text-xs text-red-500 font-medium mt-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Stok habis — sila buang dari troli
                    </p>
                  )}
                  {exceedsStock && !isOutOfStock && (
                    <p className="flex items-center gap-1 text-xs text-yellow-600 font-medium mt-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Stok tinggal {availStock}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    {/* qty controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1, variant?.id ?? null)}
                        className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 active:scale-90 active:bg-gray-100 transition-all will-change-transform"
                        aria-label="Kurang"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-black text-gray-900 select-none tabular-nums">
                        {quantity}
                      </span>
                      <button
                        onClick={() => {
                          if (availStock !== undefined && quantity >= availStock) return
                          updateQuantity(product.id, quantity + 1, variant?.id ?? null)
                        }}
                        disabled={availStock !== undefined && quantity >= availStock}
                        className="w-9 h-9 rounded-xl bg-brand-fresh-500 flex items-center justify-center text-white shadow-[0_2px_8px_rgba(34,197,94,0.35)] active:scale-90 active:shadow-none transition-all will-change-transform disabled:opacity-30 disabled:shadow-none"
                        aria-label="Tambah"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-black text-gray-900">
                        RM{(unitPrice * quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeItem(product.id, variant?.id ?? null)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 active:scale-90 transition-all will-change-transform"
                        aria-label="Buang item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Trust block */}
        <div className="mt-5 bg-gradient-to-br from-brand-fresh-50 to-white border border-brand-fresh-100/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-fresh-100 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="h-4 w-4 text-brand-fresh-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Jaminan Segar 100%</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Tak segar? Kami ganti atau refund penuh tanpa soal jawab.
              </p>
            </div>
          </div>
          <div className="border-t border-brand-fresh-100/70" />
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-fresh-100 flex items-center justify-center shrink-0 mt-0.5">
              <Truck className="h-4 w-4 text-brand-fresh-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Penghantaran Pantas</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Lembah Klang: 2–4 jam · Seluruh Malaysia: 1–3 hari lori sejuk
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky checkout bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/96 backdrop-blur-sm border-t border-gray-100/70 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+4.25rem)]">

        {/* Total + free shipping */}
        <div className="flex items-end justify-between mb-3.5">
          <div>
            <p className="text-xs text-gray-400 leading-none mb-1.5">{items.length} item dipilih</p>
            <p className="text-[28px] font-black text-gray-900 leading-none">
              RM{total.toFixed(2)}
            </p>
          </div>
          {total < 80 && (
            <div className="text-right">
              <p className="text-[11px] text-brand-fresh-600 font-semibold leading-snug">
                Tambah RM{(80 - total).toFixed(2)} lagi
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">untuk penghantaran percuma</p>
            </div>
          )}
          {total >= 80 && (
            <p className="text-[11px] text-brand-fresh-600 font-semibold">✓ Penghantaran percuma!</p>
          )}
        </div>

        {/* CTA */}
        {hasStockIssue ? (
          <div className="w-full text-center bg-gray-100 text-gray-400 font-semibold py-4 rounded-2xl text-sm">
            Sila betulkan kuantiti dahulu
          </div>
        ) : (
          <Link
            href="/checkout"
            className="w-full flex items-center justify-center gap-2 bg-brand-fresh-500 text-white font-bold py-4 rounded-2xl text-base shadow-[0_6px_22px_rgba(34,197,94,0.50),0_0_0_1px_rgba(34,197,94,0.12)] active:scale-[0.97] active:shadow-[0_2px_8px_rgba(34,197,94,0.28)] transition-all duration-150"
          >
            Teruskan ke Checkout
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </StoreLayout>
  )
}
