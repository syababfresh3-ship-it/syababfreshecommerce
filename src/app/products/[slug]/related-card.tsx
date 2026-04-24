'use client'

// optimize related products section
import Link from 'next/link'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart'
import { toast } from 'sonner'

interface RelatedCardProps {
  product: {
    id: string
    name: string
    slug: string
    price: number | string
    compare_price?: number | string | null
    image_url?: string | null
    unit?: string
  }
}

export function RelatedCard({ product }: RelatedCardProps) {
  const addItem = useCartStore((s) => s.addItem)

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addItem(product as any, 1)
    toast.success(`${product.name} ditambah ke troli`)
  }

  return (
    <Link
      href={`/products/${product.slug}`}
      className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.07)] border border-gray-100/80 active:scale-[0.97] transition-all duration-150 w-[132px] shrink-0"
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-gradient-to-b from-[#fdf8f2] to-[#f0e8dc] overflow-hidden">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover scale-[1.18]"
            sizes="132px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl select-none">🍓</div>
        )}
      </div>

      {/* Info */}
      <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-1.5">
        <p className="text-[12px] font-semibold text-gray-800 line-clamp-1 leading-snug">
          {product.name}
        </p>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[13px] font-black text-brand-fresh-600 leading-none">
            RM{Number(product.price).toFixed(2)}
          </span>
          <button
            onClick={handleAdd}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-brand-fresh-500 text-white shadow-[0_2px_8px_rgba(34,197,94,0.38)] active:scale-90 transition-all duration-150 shrink-0"
            aria-label={`Tambah ${product.name} ke troli`}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
      </div>
    </Link>
  )
}
