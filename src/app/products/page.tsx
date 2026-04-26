// search conversion optimization
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Pagination } from '@/components/ui/pagination'
import { StoreLayout } from '@/components/layout/store-layout'
import { ProductCard } from '@/components/store/product-card'
import { StickyCartBar } from '@/components/store/sticky-cart-bar'
import { CategoryFilter } from './category-filter'
import { SearchBar } from './search-bar'
import { SortFilter } from './sort-filter'
import Link from 'next/link'
import { Suspense } from 'react'
import type { Category, Product } from '@/types'

const POPULAR_SEARCHES = ['Durian', 'Mangga', 'Strawberry', 'Anggur', 'Tembikai', 'Harumanis', 'Limau', 'Betik']

export const metadata: Metadata = {
  title: 'Produk',
  description: 'Beli buah segar online — durian, mangga, strawberry dan banyak lagi. Penghantaran 2–4 jam ke Klang Valley.',
}

const PAGE_SIZE = 12

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string
    q?: string
    sort?: string
    promo?: string
    page?: string
  }>
}

async function getData(category?: string, q?: string, sort?: string, promo?: string) {
  const supabase = await createClient()

  const [categoriesRes, productsRes, stockRes, variantsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('products')
      .select('*, categories(name, slug)')
      .eq('is_active', true),
    supabase
      .from('product_stock')
      .select('product_id, available_stock'),
    supabase
      .from('product_variants')
      .select('product_id')
      .eq('is_active', true),
  ])

  const stockMap: Record<string, number> = {}
  for (const s of stockRes.data ?? []) {
    stockMap[s.product_id] = s.available_stock
  }

  const variantProductIds = new Set((variantsRes.data ?? []).map((v) => v.product_id))

  let products = (productsRes.data ?? []) as Product[]

  // Filter by category
  if (category) {
    products = products.filter((p: any) => p.categories?.slug === category)
  }

  // Filter by search
  if (q) {
    const lower = q.toLowerCase()
    products = products.filter((p) =>
      p.name.toLowerCase().includes(lower) ||
      p.description?.toLowerCase().includes(lower)
    )
  }

  // Filter promo only
  if (promo === '1') {
    products = products.filter((p) => p.compare_price != null)
  }

  // Sort
  if (sort === 'price_asc') {
    products.sort((a, b) => Number(a.price) - Number(b.price))
  } else if (sort === 'price_desc') {
    products.sort((a, b) => Number(b.price) - Number(a.price))
  } else if (sort === 'name') {
    products.sort((a, b) => a.name.localeCompare(b.name))
  } else {
    // Default: sort_order
    products.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  return {
    categories: (categoriesRes.data ?? []) as Category[],
    products,
    stockMap,
    variantProductIds,
  }
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category, q, sort, promo, page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const { categories, products, stockMap, variantProductIds } = await getData(category, q, sort, promo)

  const totalPages = Math.ceil(products.length / PAGE_SIZE)
  const pagedProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const activeCategory = categories.find((c) => c.slug === category)

  const heading = activeCategory
    ? activeCategory.name
    : q
    ? `"${q}"`
    : promo === '1'
    ? 'Tawaran & Promosi'
    : 'Semua Produk'

  return (
    <StoreLayout>
      {/* final polish: gray-50 canvas — white cards float, feel premium and separated */}
      <div className="bg-gray-50 min-h-screen">

      {/* Sticky filter bar — white so it lifts above the gray page */}
      <div className="sticky top-0 z-30 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)] px-4 pt-3 pb-2.5">

        {/* Search */}
        <Suspense><SearchBar defaultValue={q} /></Suspense>

        {/* Category filter chips — horizontal scroll */}
        <div className="mt-2.5">
          <Suspense><CategoryFilter categories={categories} activeSlug={category} showPromo /></Suspense>
        </div>
      </div>

      <div className="px-4 pt-3">

        {/* Heading + sort — tight, minimal chrome */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900">{heading}</h2>
            {/* conversion improvement: quantity cue reassures buyer there's good selection */}
            <p className="text-[10px] text-gray-400 mt-0.5">{products.length} produk segar tersedia</p>
          </div>
          <Suspense><SortFilter activeSort={sort} /></Suspense>
        </div>

        {/* conversion improvement: fast delivery urgency strip */}
        {!q && !promo && (
          <div className="flex items-center gap-2 bg-brand-fresh-50 border border-brand-fresh-100 rounded-xl px-3 py-2 mb-3">
            <span className="text-base">⚡</span>
            <p className="text-[11px] text-brand-fresh-700 font-semibold">
              Penghantaran hari ini · Order sebelum 2PM
            </p>
          </div>
        )}

        {/* Popular search chips — shown when idle (no query, no category, no promo) */}
        {!q && !category && !promo && (
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
              Carian popular
            </p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCHES.map((term) => (
                <Link
                  key={term}
                  href={`/products?q=${encodeURIComponent(term)}`}
                  className="px-3 py-1.5 bg-white rounded-full text-xs font-semibold text-gray-700 shadow-[0_1px_6px_rgba(0,0,0,0.07)] border border-gray-100 active:scale-95 active:bg-gray-50 transition-all duration-150"
                >
                  🔍 {term}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center px-6">
            <p className="text-4xl mb-4">😢</p>
            <p className="text-[15px] font-bold text-gray-700 mb-1.5">Tak jumpa hasil carian</p>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              Cuba kata kunci lain atau semak ejaan
            </p>
            <Link
              href="/products"
              className="bg-brand-fresh-500 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-[0_4px_14px_rgba(34,197,94,0.38)] active:scale-[0.97] transition-all duration-150 mb-6"
            >
              Lihat semua produk
            </Link>
            {/* Popular searches in no-result state */}
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Cuba cari</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {POPULAR_SEARCHES.slice(0, 6).map((term) => (
                <Link
                  key={term}
                  href={`/products?q=${encodeURIComponent(term)}`}
                  className="px-3 py-1.5 bg-white rounded-full text-xs font-semibold text-gray-600 shadow-[0_1px_6px_rgba(0,0,0,0.07)] border border-gray-100 active:scale-95 transition-all duration-150"
                >
                  {term}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* final polish: gap-4 gives rows room to breathe — scroll feels lighter */}
            <div className="grid grid-cols-2 gap-4">
              {pagedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  stock={stockMap[product.id] ?? null}
                  hasVariants={variantProductIds.has(product.id)}
                />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(p) => {
                const params = new URLSearchParams()
                if (category) params.set('category', category)
                if (q) params.set('q', q)
                if (sort) params.set('sort', sort)
                if (promo) params.set('promo', promo)
                params.set('page', String(p))
                return `/products?${params.toString()}`
              }}
            />
          </>
        )}

        {/* Extra bottom space so last card clears the sticky cart bar */}
        <div className="h-20" />
      </div>

      </div> {/* end bg-gray-50 */}

      {/* conversion improvement: sticky cart bar — always-visible checkout nudge */}
      <StickyCartBar />
    </StoreLayout>
  )
}
