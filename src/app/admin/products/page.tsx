import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { ProductToggle } from './product-toggle'
import { FeaturedToggle } from './featured-toggle'

async function getProducts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('*, categories(name)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminProductsPage() {
  const products = await getProducts()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Produk</h1>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Produk
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Featured</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aktif</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                  Tiada produk. <Link href="/admin/products/new" className="text-red-600 font-medium">Tambah sekarang</Link>
                </td>
              </tr>
            ) : (
              products.map((product: any) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{product.slug}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {product.categories?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-semibold text-gray-900">RM{Number(product.price).toFixed(2)}</span>
                    {product.compare_price && (
                      <span className="block text-xs text-gray-400 line-through">
                        RM{Number(product.compare_price).toFixed(2)}
                      </span>
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
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
