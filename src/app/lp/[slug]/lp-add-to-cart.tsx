'use client'

import { useState } from 'react'
import { useCartStore } from '@/lib/stores/cart'
import { toast } from 'sonner'
import { ShoppingCart, Minus, Plus } from 'lucide-react'
import type { Product } from '@/types'

export function LpAddToCartBtn({ product, stock }: { product: Product; stock: number | null }) {
  const [qty, setQty] = useState(1)
  const addItem = useCartStore((s) => s.addItem)

  if (stock === 0) {
    return (
      <button disabled className="w-full py-3 rounded-xl bg-red-50 text-red-400 font-bold text-sm border border-red-100">
        Stok Habis
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
        <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors">
          <Minus className="h-3.5 w-3.5 text-gray-600" strokeWidth={2.5} />
        </button>
        <span className="w-7 text-center text-sm font-black text-gray-900">{qty}</span>
        <button onClick={() => setQty(q => stock !== null ? Math.min(stock, q + 1) : q + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors">
          <Plus className="h-3.5 w-3.5 text-gray-600" strokeWidth={2.5} />
        </button>
      </div>
      <button
        onClick={() => { addItem(product, qty); toast.success(`${qty}x ${product.name} ditambah ke troli`) }}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 text-white font-bold text-sm shadow-md hover:bg-green-600 active:scale-[0.97] transition-all"
      >
        <ShoppingCart className="h-4 w-4" />
        Tambah — RM{(Number(product.price) * qty).toFixed(2)}
      </button>
    </div>
  )
}
