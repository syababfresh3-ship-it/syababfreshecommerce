'use client'

import { useState } from 'react'
import { useLpCart } from '@/lib/stores/lp-cart'
import { toast } from 'sonner'
import { Minus, Plus, ShoppingBag, Check } from 'lucide-react'
import type { Product, ProductVariant } from '@/types'

interface Props {
  product: Product
  stock: number | null
  variants: ProductVariant[]
}

export function LpAddToCartBtn({ product, stock, variants }: Props) {
  const activeVariants = variants.filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order)
  const hasVariants = activeVariants.length > 0

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    hasVariants ? activeVariants[0] : null
  )
  const [qty, setQty] = useState(1)
  const [justAdded, setJustAdded] = useState(false)

  const addItem = useLpCart(s => s.addItem)
  const cartItems = useLpCart(s => s.items)

  const displayPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price)
  const comparePrice = selectedVariant ? selectedVariant.compare_price : product.compare_price

  const inCart = cartItems.find(
    i => i.productId === product.id && i.variantId === (selectedVariant?.id ?? null)
  )

  if (stock === 0) {
    return (
      <button disabled className="w-full py-3 mt-3 rounded-xl bg-red-50 text-red-400 font-bold text-sm border border-red-100">
        Stok Habis
      </button>
    )
  }

  function handleAdd() {
    if (hasVariants && !selectedVariant) { toast.error('Sila pilih saiz'); return }
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      productName: product.name,
      variantName: selectedVariant?.name ?? null,
      qty,
      unitPrice: displayPrice,
      imageUrl: (product as any).image_url ?? null,
    })
    setJustAdded(true)
    toast.success(`${product.name}${selectedVariant ? ` (${selectedVariant.name})` : ''} ditambah!`)
    setTimeout(() => setJustAdded(false), 2000)
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Variant selector */}
      {hasVariants && (
        <div className="flex flex-wrap gap-2">
          {activeVariants.map(v => (
            <button
              key={v.id}
              onClick={() => setSelectedVariant(v)}
              className="px-3 py-1.5 rounded-xl text-sm font-bold border transition-all"
              style={selectedVariant?.id === v.id
                ? { background: 'var(--cherry, #22c55e)', color: '#fff', borderColor: 'var(--cherry, #22c55e)', boxShadow: '0 2px 8px rgba(156,15,48,0.2)' }
                : { background: 'var(--cherry-light, #f9fafb)', color: 'var(--text, #374151)', borderColor: 'var(--cherry-border, #e5e7eb)' }
              }
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      {/* Price + qty */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xl font-black text-green-600">RM{(displayPrice * qty).toFixed(2)}</span>
          {comparePrice && Number(comparePrice) > displayPrice && (
            <span className="ml-2 text-sm text-gray-400 line-through">RM{(Number(comparePrice) * qty).toFixed(2)}</span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl px-1 py-1">
          <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors">
            <Minus className="h-3.5 w-3.5 text-gray-600" strokeWidth={2.5} />
          </button>
          <span className="w-7 text-center text-sm font-black text-gray-900">{qty}</span>
          <button onClick={() => setQty(q => stock !== null ? Math.min(stock, q + 1) : q + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors">
            <Plus className="h-3.5 w-3.5 text-gray-600" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Add to LP cart */}
      <button
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm active:scale-[0.97] transition-all"
        style={justAdded
          ? { background: 'var(--cherry-dark, #16a34a)', color: '#fff' }
          : inCart
          ? { background: 'var(--cherry-light, #f0fdf4)', color: 'var(--cherry, #16a34a)', border: '2px solid var(--cherry, #22c55e)' }
          : { background: 'var(--cherry, #22c55e)', color: '#fff', boxShadow: '0 4px 16px rgba(156,15,48,0.3)' }
        }
      >
        {justAdded ? (
          <><Check className="h-4 w-4" strokeWidth={2.5} /> Ditambah!</>
        ) : inCart ? (
          <><ShoppingBag className="h-4 w-4" /> Tambah Lagi ({inCart.qty} dalam pesanan)</>
        ) : (
          <><ShoppingBag className="h-4 w-4" /> Tambah ke Pesanan</>
        )}
      </button>
    </div>
  )
}
