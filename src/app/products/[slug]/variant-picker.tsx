'use client'

import { useState } from 'react'
import { useCartStore } from '@/lib/stores/cart'
import { toast } from 'sonner'
import { ShoppingCart, Minus, Plus } from 'lucide-react'
import type { Product, ProductVariant } from '@/types'

interface Props {
  product: Product
  variants: ProductVariant[]
}

export function VariantPicker({ product, variants }: Props) {
  const [selected, setSelected] = useState<ProductVariant | null>(null)
  const [qty, setQty] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  const activeVariants = variants.filter(v => v.is_active)
  const displayPrice = selected ? selected.price : null
  const displayCompare = selected ? selected.compare_price : null
  const maxQty = selected ? selected.stock : 0
  const isOutOfStock = selected ? selected.stock === 0 : false

  function handleAdd() {
    if (!selected) { toast.error('Sila pilih variasi terlebih dahulu'); return }
    if (isOutOfStock) { toast.error('Stok habis'); return }
    addItem(product, qty, selected)
    toast.success(`${qty}x ${product.name} — ${selected.name} ditambah ke troli`)
  }

  return (
    <div className="space-y-4">
      {/* Variant pills */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Pilih Saiz / Variasi</p>
        <div className="flex flex-wrap gap-2">
          {activeVariants.map(v => {
            const isSelected = selected?.id === v.id
            const outOfStock = v.stock === 0
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => { setSelected(v); setQty(1) }}
                disabled={outOfStock}
                className={`relative px-4 py-2.5 rounded-2xl border text-sm font-semibold transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                    : outOfStock
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed line-through'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                <span>{v.name}</span>
                <span className={`block text-xs mt-0.5 font-black ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                  RM{Number(v.price).toFixed(2)}
                </span>
                {outOfStock && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full font-bold">
                    Habis
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected price display */}
      {selected && (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-gray-900">RM{Number(displayPrice).toFixed(2)}</span>
          {displayCompare && Number(displayCompare) > Number(displayPrice) && (
            <span className="text-sm text-gray-400 line-through">RM{Number(displayCompare).toFixed(2)}</span>
          )}
          {selected.weight_grams && (
            <span className="text-xs text-gray-400 ml-auto">{selected.weight_grams >= 1000 ? `${selected.weight_grams / 1000}kg` : `${selected.weight_grams}g`}</span>
          )}
        </div>
      )}

      {/* Add to cart */}
      {selected ? (
        isOutOfStock ? (
          <button disabled className="w-full py-4 rounded-2xl bg-red-50 text-red-400 font-bold text-sm border border-red-100 opacity-70">
            Stok Habis
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-2xl px-1.5 py-1.5">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-200 active:scale-90 transition-all duration-150"
              >
                <Minus className="h-4 w-4 text-gray-600" strokeWidth={2.5} />
              </button>
              <span className="w-8 text-center text-[15px] font-black text-gray-900">{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(maxQty, q + 1))}
                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-200 active:scale-90 transition-all duration-150"
              >
                <Plus className="h-4 w-4 text-gray-600" strokeWidth={2.5} />
              </button>
            </div>
            <button
              onClick={handleAdd}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-fresh-500 text-white font-bold text-sm shadow-[0_6px_22px_rgba(34,197,94,0.52),0_0_0_1px_rgba(34,197,94,0.12)] active:scale-[0.97] transition-all duration-150"
            >
              <ShoppingCart className="h-4 w-4" />
              Tambah ke Troli — RM{(Number(selected.price) * qty).toFixed(2)}
            </button>
          </div>
        )
      ) : (
        <button
          onClick={() => toast.error('Sila pilih variasi terlebih dahulu')}
          className="w-full py-4 rounded-2xl bg-gray-100 text-gray-400 font-bold text-sm border border-gray-200"
        >
          Pilih variasi dahulu
        </button>
      )}

      {selected && maxQty <= 5 && maxQty > 0 && (
        <p className="text-xs text-orange-500 font-medium text-center">
          ⚡ Tinggal {maxQty} unit sahaja
        </p>
      )}
    </div>
  )
}
