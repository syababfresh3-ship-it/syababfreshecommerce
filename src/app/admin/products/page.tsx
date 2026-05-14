export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Plus, Pencil, Search, GripVertical, Star, ImageOff } from 'lucide-react'
import { ProductToggle } from './product-toggle'
import { FeaturedToggle } from './featured-toggle'
import { Pagination } from '@/components/admin/pagination'

const PAGE_SIZE = 20

async function getProducts(page: number, q?: string, cat?: string) {
  const supabase = createClient()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('products')
    .select('*, categories(id, name)', { count: 'exact' })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) query = query.ilike('name', `%${q}%`)
  if (cat) query = query.eq('category_id', cat)

  const { data, count } = await query
  return { products: data ?? [], total: count ?? 0 }
}

async function getCategories() {
  const supabase = createClient()
  const { data } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('is_active', true)
    .order('sort_order')
  return data ?? []
}

const categoryColors: Record<string, string> = {
  default: 'bg-gray-100 text-gray-600',
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; cat?: string }>
}) {
  const { page: pageStr, q, cat } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const [{ products, total }, categories] = await Promise.all([
    getProducts(page, q, cat),
    getCategories(),
  ])
  const activeCat = categories.find(c => c.id === cat)

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Produk</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} produk
            {activeCat ? ` · ${activeCat.name}` : ''}
            {q ? ` · "${q}"` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products/sort"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <GripVertical className="h-4 w-4" />
            Urus Urutan
          </Link>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Tambah Produk</span>
            <span className="sm:hidden">Tambah</span>
          </Link>
        </div>
      </div>

      {/* Search + Category filter */}
      <form method="GET" className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Cari nama produk..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm"
          />
        </div>
        <select
          name="cat"
          defaultValue={cat ?? ''}
          className="py-2.5 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm text-gray-700 min-w-[140px]"
        >
          <option value="">Semua Kategori</option>
          {categories.filter(c => !c.parent_id).map(parent => (
            <optgroup key={parent.id} label={parent.name}>
              <option value={parent.id}>{parent.name} (semua)</option>
              {categories.filter(c => c.parent_id === parent.id).map(child => (
                <option key={child.id} value={child.id}>↳ {child.name}</option>
              ))}
            </optgroup>
          ))}
          {categories.filter(c => c.parent_id && !categories.find(p => p.id === c.parent_id && !p.parent_id)).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm">
          Tapis
        </button>
        {(q || cat) && (
          <a href="/admin/products" className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 font-medium">
            Reset
          </a>
        )}
      </form>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {products.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-12">
            {q ? `Tiada produk sepadan "${q}"` : 'Tiada produk.'}
          </p>
        ) : products.map((product: any) => {
          const hasDiscount = product.compare_price && Number(product.compare_price) > Number(product.price)
          const discountPct = hasDiscount
            ? Math.round((1 - Number(product.price) / Number(product.compare_price)) * 100)
            : 0
          return (
            <div key={product.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 ${!product.is_active ? 'opacity-60' : ''}`}>
              <div className="h-12 w-12 rounded-lg border border-gray-100 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageOff className="h-4 w-4 text-gray-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{product.name}</p>
                {product.categories?.name && (
                  <span className="text-[11px] text-blue-600">{product.categories.name}</span>
                )}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-bold text-gray-900 text-sm">RM{Number(product.price).toFixed(2)}</span>
                  {hasDiscount && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">-{discountPct}%</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {product.is_featured && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                <ProductToggle id={product.id} isActive={product.is_active} />
                <Link
                  href={`/admin/products/${product.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )
        })}
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          basePath="/admin/products"
          params={q ? { q } : {}}
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Produk</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategori</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Harga</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Featured</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktif</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                  {q ? `Tiada produk sepadan "${q}"` : (
                    <>Tiada produk. <Link href="/admin/products/new" className="text-red-600 font-semibold hover:underline">Tambah sekarang</Link></>
                  )}
                </td>
              </tr>
            ) : (
              products.map((product: any) => {
                const hasDiscount = product.compare_price && Number(product.compare_price) > Number(product.price)
                const discountPct = hasDiscount
                  ? Math.round((1 - Number(product.price) / Number(product.compare_price)) * 100)
                  : 0
                return (
                  <tr key={product.id} className={`hover:bg-gray-50/80 transition-colors group ${!product.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg border border-gray-100 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <ImageOff className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 leading-tight">{product.name}</div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{product.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {product.categories?.name ? (
                        <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-lg">
                          {product.categories.name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="font-bold text-gray-900">RM{Number(product.price).toFixed(2)}</div>
                      {hasDiscount && (
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-[10px] text-gray-400 line-through">RM{Number(product.compare_price).toFixed(2)}</span>
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">-{discountPct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <FeaturedToggle id={product.id} isFeatured={product.is_featured ?? false} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <ProductToggle id={product.id} isActive={product.is_active} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          basePath="/admin/products"
          params={q ? { q } : {}}
        />
      </div>
    </div>
  )
}
