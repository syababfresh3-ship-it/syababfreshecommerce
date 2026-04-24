import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'
import { AddBatchForm } from './add-batch-form'

async function getData() {
  const supabase = await createClient()

  const [productsRes, batchesRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('inventory_batches')
      .select('*, products(name)')
      .order('expiry_date', { ascending: true })
      .limit(100),
  ])

  // Stock per product
  const { data: stockData } = await supabase
    .from('product_stock')
    .select('*')

  const stockMap = Object.fromEntries(
    (stockData ?? []).map((s: any) => [s.product_id, s.available_stock])
  )

  return {
    products: productsRes.data ?? [],
    batches: batchesRes.data ?? [],
    stockMap,
  }
}

function stockBadge(stock: number) {
  if (stock === 0) return { label: 'Habis', cls: 'bg-red-100 text-red-600' }
  if (stock <= 10) return { label: `${stock} unit`, cls: 'bg-yellow-100 text-yellow-700' }
  return { label: `${stock} unit`, cls: 'bg-green-100 text-green-700' }
}

function expiryBadge(date: string) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: 'Tamat', cls: 'bg-red-100 text-red-600' }
  if (days <= 2) return { label: `${days}h lagi`, cls: 'bg-red-100 text-red-600' }
  if (days <= 5) return { label: `${days}h lagi`, cls: 'bg-yellow-100 text-yellow-700' }
  return { label: `${days}h lagi`, cls: 'bg-green-100 text-green-700' }
}

export default async function InventoryPage() {
  const { products, batches, stockMap } = await getData()

  const expiringSoon = batches.filter((b: any) => {
    const days = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 3 && b.quantity > 0
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Inventori</h1>
      </div>

      {/* Expiry Warning */}
      {expiringSoon.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">
              {expiringSoon.length} batch hampir tamat tempoh
            </p>
            <ul className="mt-1 space-y-0.5">
              {expiringSoon.map((b: any) => (
                <li key={b.id} className="text-xs text-yellow-700">
                  {b.products?.name} — {b.quantity} unit, tamat {new Date(b.expiry_date).toLocaleDateString('ms-MY')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Add Batch Form */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="h-4 w-4 text-brand-red-600" />
              <h2 className="font-semibold text-gray-900">Tambah Batch Stok</h2>
            </div>
            <AddBatchForm products={products as any} />
          </div>
        </div>

        {/* Stock Overview */}
        <div className="col-span-2 space-y-4">
          {/* Stock Summary per product */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Stok Semasa</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Produk</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Stok Tersedia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((p: any) => {
                    const stock = stockMap[p.id] ?? 0
                    const badge = stockBadge(stock)
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-800 font-medium">{p.name}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Batch History */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Batch Aktif</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Produk</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Kuantiti</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Tarikh Masuk</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Tamat Tempoh</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Pembekal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tiada batch lagi</td>
                    </tr>
                  ) : (
                    batches.map((b: any) => {
                      const expiry = expiryBadge(b.expiry_date)
                      return (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-800">{b.products?.name}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">{b.quantity}</td>
                          <td className="px-4 py-2.5 text-center text-gray-500 text-xs">
                            {new Date(b.batch_date).toLocaleDateString('ms-MY')}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${expiry.cls}`}>
                              {expiry.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{b.supplier ?? '—'}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
