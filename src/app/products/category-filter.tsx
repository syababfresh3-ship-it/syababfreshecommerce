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

  // Split into parents (no parent_id) and children (has parent_id)
  const parents = categories.filter(c => c.parent_id === null)
  const children = categories.filter(c => c.parent_id !== null)

  // Find which parent is active — either directly selected, or parent of active child
  const activeChild = children.find(c => c.slug === activeSlug)
  const activeParent = parents.find(p =>
    p.slug === activeSlug || p.id === activeChild?.parent_id
  )

  // Sub-categories to show when a parent is selected
  const activeSubs = activeParent
    ? children.filter(c => c.parent_id === activeParent.id)
    : []

  return (
    <div className="space-y-2">
      {/* Row 1: parent categories */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-touch pb-0.5 -mx-4 px-4">
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

        {parents.map((parent) => (
          <Link
            key={parent.slug}
            href={`/products?category=${parent.slug}`}
            className={cn(
              'shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95',
              activeParent?.slug === parent.slug
                ? 'bg-brand-red-600 text-white shadow-sm shadow-brand-red-200'
                : 'bg-white text-gray-600 border border-gray-200'
            )}
          >
            {parent.name}
          </Link>
        ))}
      </div>

      {/* Row 2: sub-categories (shown only when a parent is active) */}
      {activeSubs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-touch pb-0.5 -mx-4 px-4">
          {/* "Semua" chip — links back to parent to show all sub-category products */}
          <Link
            href={`/products?category=${activeParent!.slug}`}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95',
              activeSlug === activeParent!.slug
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            Semua
          </Link>

          {activeSubs.map((sub) => (
            <Link
              key={sub.slug}
              href={`/products?category=${sub.slug}`}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95',
                activeSlug === sub.slug
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              )}
            >
              {/* Strip redundant prefix e.g. "Kurma Ajwa" → "Ajwa" */}
              {sub.name.replace(/^Kurma\s+/i, '')}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
