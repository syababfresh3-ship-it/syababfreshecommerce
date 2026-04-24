'use client'

import { useState } from 'react'
import { useCartStore } from '@/lib/stores/cart'
import { toast } from 'sonner'
import { ShoppingCart, Minus, Plus } from 'lucide-react'
import type { Product } from '@/types'

export function AddToCartButton({ product, stock }: { product: Product; stock: number | null }) {
  const [qty, setQty] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  function handleAdd() {
    addItem(product, qty)
    toast.success(`${qty}x ${product.name} ditambah ke troli`)
  }

  // final product polish
  // null = no stock record, treat as available
  if (stock === 0) {
    return (
      <button disabled className="w-full py-4 rounded-2xl bg-red-50 text-red-400 font-bold text-sm border border-red-100 opacity-70">
        Stok Habis
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* Qty selector */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-2xl px-1.5 py-1.5">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-200 active:scale-90 transition-all duration-150"
        >
          <Minus className="h-4 w-4 text-gray-600" strokeWidth={2.5} />
        </button>
        <span className="w-8 text-center text-[15px] font-black text-gray-900">{qty}</span>
        <button
          onClick={() => setQty((q) => stock !== null ? Math.min(stock, q + 1) : q + 1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-200 active:scale-90 transition-all duration-150"
        >
          <Plus className="h-4 w-4 text-gray-600" strokeWidth={2.5} />
        </button>
      </div>

      {/* Add button */}
      <button
        onClick={handleAdd}
        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-brand-fresh-500 text-white font-bold text-sm shadow-[0_6px_22px_rgba(34,197,94,0.52),0_0_0_1px_rgba(34,197,94,0.12)] active:scale-[0.97] active:shadow-[0_2px_8px_rgba(34,197,94,0.28)] transition-all duration-150"
      >
        <ShoppingCart className="h-4 w-4" />
        Tambah ke Troli — RM{(Number(product.price) * qty).toFixed(2)}
      </button>
    </div>
  )
}
