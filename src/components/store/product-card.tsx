'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Plus, ChevronRight } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Product } from '@/types'
import { WishlistButton } from './wishlist-button'

interface ProductCardProps {
  product: Product
  stock?: number | null
  hasVariants?: boolean
}

export function ProductCard({ product, stock, hasVariants }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const router = useRouter()

  function handleAddToCart(e: React.MouseEvent) {
    e.stopPropagation()
    if (hasVariants) {
      router.push(`/products/${product.slug}`)
      return
    }
    if (stock === 0) return
    addItem(product, 1)
    toast.success(`${product.name} ditambah ke troli`)
  }

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : null

  const outOfStock = stock === 0
  const lowStock = stock != null && stock > 0 && stock <= 5

  // catalog conversion boost
  return (
    // card container — not a Link, so button clicks don't accidentally navigate
    <div className={`bg-white rounded-2xl overflow-hidden border border-gray-100/70 shadow-[0_4px_20px_rgba(0,0,0,0.10)] active:scale-[0.97] active:shadow-[0_8px_24px_rgba(0,0,0,0.14)] transition-all duration-150 ${outOfStock ? 'opacity-50' : ''}`}>

      {/* IMAGE — wrapped in Link so tapping the photo navigates to product page */}
      <Link
        href={`/products/${product.slug}`}
        className="block relative aspect-square bg-[#f0f0ee] overflow-hidden will-change-transform"
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover scale-[1.28]"
            sizes="(max-width: 640px) 50vw, 220px"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl select-none">🍓</div>
        )}

        {/* depth gradient at image bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/22 to-transparent" />

        {/* Top-left badge */}
        {discount && !outOfStock ? (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full shadow-[0_2px_8px_rgba(239,68,68,0.45)]">
            -{discount}%
          </span>
        ) : !outOfStock ? (
          <span className="absolute top-2 left-2 bg-brand-fresh-500/90 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Segar
          </span>
        ) : null}

        {/* Bottom-left: Best Seller or Low Stock */}
        {product.is_featured && !outOfStock && (
          <span className="absolute bottom-2 left-2 bg-brand-yellow-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
            ★ Best Seller
          </span>
        )}
        {lowStock && !product.is_featured && (
          <span className="absolute bottom-2 left-2 bg-orange-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
            Tinggal {stock}!
          </span>
        )}

        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full">
              Stok Habis
            </span>
          </div>
        )}

        {/* Wishlist — top right */}
        <WishlistButton
          productId={product.id}
          className="absolute top-1 right-1 bg-white/85 backdrop-blur-sm rounded-full shadow-sm"
        />
      </Link>

      {/* INFO — name navigates, button adds to cart — two separate actions, zero conflict */}
      {/* fix price vs CTA overlap issue */}
      <div className="px-3.5 pt-3 pb-3.5 flex flex-col gap-2.5">

        {/* Name — tapping navigates to product page */}
        <Link href={`/products/${product.slug}`} className="block">
          <h4 className="text-[13px] font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[2.6em]">
            {product.name}
          </h4>
        </Link>

        {/* Price row — full width, no competition from button */}
        <div>
          <div className="flex items-baseline gap-1.5">
            {hasVariants ? (
              <span className="text-[13px] font-semibold text-gray-500 leading-none">
                Dari <span className="text-[16px] font-black text-brand-fresh-600">RM{Number(product.price).toFixed(2)}</span>
              </span>
            ) : (
              <>
                <span className="text-[16px] font-black text-brand-fresh-600 leading-none">
                  RM{Number(product.price).toFixed(2)}
                </span>
                {product.compare_price && (
                  <span className="text-[11px] text-gray-400 line-through leading-none">
                    RM{Number(product.compare_price).toFixed(2)}
                  </span>
                )}
              </>
            )}
          </div>
          {!hasVariants && <span className="text-[10px] text-gray-400 mt-0.5 block">/{product.unit}</span>}
        </div>

        {/* Add button — full width below price, NOT inside a Link */}
        <button
          onClick={handleAddToCart}
          disabled={outOfStock && !hasVariants}
          className="w-full h-9 rounded-xl bg-brand-fresh-500 flex items-center justify-center gap-1 text-white shadow-[0_4px_14px_rgba(34,197,94,0.48)] active:scale-[0.88] active:shadow-[0_1px_4px_rgba(34,197,94,0.25)] transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed"
          aria-label={hasVariants ? `Pilih saiz ${product.name}` : `Tambah ${product.name} ke troli`}
          suppressHydrationWarning
        >
          {hasVariants ? (
            <>
              <span className="text-[11px] font-bold">Pilih Saiz</span>
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" strokeWidth={3} />
              <span className="text-[11px] font-bold">Add</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
