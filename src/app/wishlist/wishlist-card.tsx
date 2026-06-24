'use client'

// wishlist conversion optimization
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { WishlistButton } from '@/components/store/wishlist-button'
import { toast } from 'sonner'
import type { Product } from '@/types'

export function WishlistCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addItem(product, 1)
    toast.success(`${product.name} ditambah ke troli`)
  }

  const discount = product.compare_price && product.compare_price > product.price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : null

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.09)] border border-gray-100/70 flex flex-col active:scale-[0.98] transition-all duration-150">

      {/* Image */}
      <Link href={`/products/${product.slug}`} className="block relative aspect-square bg-gradient-to-b from-[#fdf8f2] to-[#f0e8dc] overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover scale-[1.22]"
            sizes="(max-width: 640px) 50vw, 220px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl select-none">🍓</div>
        )}

        {/* depth gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/18 to-transparent" />

        {/* Discount badge */}
        {discount && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-[0_2px_8px_rgba(239,68,68,0.4)]">
            -{discount}%
          </span>
        )}

        {/* Featured badge */}
        {product.is_featured && !discount && (
          <span className="absolute top-2 left-2 bg-brand-yellow-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
            🔥 Popular
          </span>
        )}

        {/* Remove from wishlist — heart overlay top-right */}
        <WishlistButton
          productId={product.id}
          className="absolute top-1 right-1 bg-white/85 backdrop-blur-sm rounded-full shadow-sm"
        />
      </Link>

      {/* Info */}
      <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-2 flex-1">
        <Link href={`/products/${product.slug}`} className="block flex-1">
          <h4 className="text-[13px] font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[2.6em]">
            {product.name}
          </h4>
        </Link>

        {/* Price row */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-[16px] font-black text-brand-fresh-600 leading-none">
            RM{Number(product.price).toFixed(2)}
          </span>
          {product.compare_price && (
            <span className="text-[11px] text-gray-400 line-through leading-none">
              RM{Number(product.compare_price).toFixed(2)}
            </span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">/{product.unit}</span>
        </div>

        {/* Full-width CTA */}
        <button
          onClick={handleAddToCart}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-fresh-500 text-white text-[12px] font-bold shadow-[0_4px_14px_rgba(34,197,94,0.42)] active:scale-[0.97] active:shadow-[0_1px_4px_rgba(34,197,94,0.25)] transition-all duration-150"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          Tambah ke Troli
        </button>
      </div>
    </div>
  )
}
