'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Category } from '@/types'

interface CategoryFilterProps {
  categories: Category[]
  activeSlug?: string
  showPromo?: boolean
}

export function CategoryFilter({ categories, activeSlug, showPromo }: CategoryFilterProps) {
  const searchParams = useSearchParams()
  const activePromo = searchParams.get('promo') === '1'

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-touch pb-1 -mx-4 px-4">
      <Link
        href="/products"
        className={cn(
          'shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95',
          !activeSlug && !activePromo
            ? 'bg-brand-red-600 text-white shadow-sm shadow-brand-red-200'
            : 'bg-white text-gray-600 border border-gray-200'
        )}
      >
        Semua
      </Link>

      {showPromo && (
        <Link
          href="/products?promo=1"
          className={cn(
            'shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95',
            activePromo
              ? 'bg-brand-red-600 text-white shadow-sm shadow-brand-red-200'
              : 'bg-white text-brand-red-600 border border-brand-red-200'
          )}
        >
          🔥 Promosi
        </Link>
      )}

      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={`/products?category=${cat.slug}`}
          className={cn(
            'shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95',
            activeSlug === cat.slug
              ? 'bg-brand-red-600 text-white shadow-sm shadow-brand-red-200'
              : 'bg-white text-gray-600 border border-gray-200'
          )}
        >
          {cat.name}
        </Link>
      ))}
    </div>
  )
}
