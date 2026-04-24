'use client'

import { useCartStore } from '@/lib/stores/cart'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

interface OrderItem {
  product_id: string
  product_name: string
  product_image: string | null
  unit_price: number
  quantity: number
}

// success page optimization: variant controls visual weight without touching logic
export function ReorderButton({
  items,
  variant = 'default',
}: {
  items: OrderItem[]
  variant?: 'default' | 'conversion'
}) {
  const { addItem, clearCart } = useCartStore()
  const router = useRouter()

  function handleReorder() {
    clearCart()
    for (const item of items) {
      addItem(
        {
          id: item.product_id,
          name: item.product_name,
          price: item.unit_price,
          image_url: item.product_image,
        } as any,
        item.quantity
      )
    }
    toast.success('Item ditambah ke troli')
    router.push('/cart')
  }

  if (variant === 'conversion') {
    // success page optimization: fast and effortless framing — icon + helper text drives urgency
    return (
      <div className="space-y-1.5">
        <button
          onClick={handleReorder}
          className="flex items-center gap-2 w-full justify-center py-3.5 rounded-2xl bg-gray-900 text-white text-sm font-bold shadow-[0_2px_10px_rgba(0,0,0,0.12)] active:scale-[0.98] transition-transform"
        >
          <RefreshCw className="h-4 w-4 opacity-70" />
          Beli Semula
        </button>
        <p className="text-center text-[11px] text-gray-400">
          Order sama dalam 3 saat
        </p>
        <p className="text-center text-[11px] text-orange-400 font-medium">
          ⚡ Stok cepat habis setiap hari
        </p>
      </div>
    )
  }

  return (
    <button
      onClick={handleReorder}
      className="flex items-center gap-2 w-full justify-center py-3 rounded-xl border border-brand-red-600 text-brand-red-600 text-sm font-semibold hover:bg-brand-red-50 transition-colors"
    >
      <RefreshCw className="h-4 w-4" />
      Beli Semula
    </button>
  )
}
