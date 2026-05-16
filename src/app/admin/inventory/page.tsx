export const dynamic = 'force-dynamic'
import { createAdminClient as createClient } from '@/lib/supabase/admin'
import { AlertTriangle, Package, TrendingDown, Search } from 'lucide-react'
import { AddBatchForm } from './add-batch-form'
import { Pagination } from '@/components/admin/pagination'
import { StokSemasa } from './stok-semasa'
import Link from 'next/link'

const BATCH_PAGE_SIZE = 25

async function getData(batchPage: number, batchSearch?: string) {
  const supabase = createClient()
  const from = (batchPage - 1) * BATCH_PAGE_SIZE
  const to = from + BATCH_PAGE_SIZE - 1

  let batchQuery = supabase
    .from('inventory_batches')
    .select('*, products(name)', { count: 'exact' })
    .order('expiry_date', { ascending: true })

  if (batchSearch) {
    // Filter by product name via join
    const { data: matchedProducts } = await supabase
      .from('products')
      .select('id')
      .ilike('name', `%${batchSearch}%`)
    const ids = (matchedProducts ?? []).map((p: any) => p.id)
    if (ids.length === 0) {
      batchQuery = batchQuery.in('product_id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      batchQuery = batchQuery.in('product_id', ids)
    }
  }

  const [productsRes, batchesRes, stockRes] = await Promise.all([
    supabase.from('products').select('id, name, slug').eq('is_active', true).order('name'),
    batchQuery.range(from, to),
    supabase.from('product_stock').select('*'),
  ])

  const { data: expiringSoonData } = await supabase
    .from('inventory_batches')
    .select('*, products(name)')
    .gt('quantity', 0)
    .lte('expiry_date', new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0])
    .gte('expiry_date', new Date().toISOString().split('T')[0])
    .order('expiry_date', { ascending: true })
    .limit(10)

  const stockMap = Object.fromEntries(
    (stockRes.data ?? []).map((s: any) => [s.product_id, s.available_stock])
  )

  return {
    products: productsRes.data ?? [],
    batches: batchesRes.data ?? [],
    batchTotal: batchesRes.count ?? 0,
    stockMap,
    expiringSoon: expiringSoonData ?? [],
  }
}

function expiryInfo(date: string) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  if (days < 0)  return { label: 'Tamat', days, cls: 'bg-red-100 text-red-600 border-red-200', rowCls: 'bg-red-50/40 opacity-60' }
  if (days <= 2) return { label: `${days}h lagi`, days, cls: 'bg-red-100 text-red-600 border-red-200', rowCls: 'bg-red-50/30' }
  if (days <= 5) return { label: `${days}h lagi`, days, cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', rowCls: '' }
  return { label: `${days}h lagi`, days, cls: 'bg-green-100 text-green-700 border-green-200', rowCls: '' }
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; bq?: string }>
}) {
  const { page: pageStr, bq } = await searchParams
  const batchPage = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const { products, batches, batchTotal, stockMap, expiringSoon } = await getData(batchPage, bq)

  const outOfStock = products.filter((p: any) => (stockMap[p.id] ?? 0) === 0).length
  const lowStock   = products.filter((p: any) => { const s = stockMap[p.id] ?? 0; return s > 0 && s <= 10 }).length

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Inventori</h1>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
          <Package className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">{products.length} produk aktif</span>
        </div>
        {outOfStock > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-red-700">{outOfStock} kehabisan stok</span>
          </div>
        )}
        {lowStock > 0 && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold text-yellow-700">{lowStock} stok rendah</span>
          </div>
        )}
        {expiringSoon.length > 0 && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">{expiringSoon.length} batch hampir tamat</span>
          </div>
        )}
      </div>

      {/* Expiry Warning detail */}
      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-orange-800 mb-1">Batch hampir tamat tempoh — tindakan segera diperlukan</p>
            <div className="space-y-1">
              {expiringSoon.map((b: any) => (
                <p key={b.id} className="text-xs text-orange-700">
                  <span className="font-semibold">{b.products?.name}</span> — {b.quantity} unit, tamat{' '}
                  {new Date(b.expiry_date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Add Batch Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-6">
            <h2 className="font-bold text-gray-900 mb-4">Tambah Batch Stok</h2>
            <AddBatchForm products={products as any} />
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stock per product — client component with search + filter + pagination */}
          <StokSemasa products={products as any} stockMap={stockMap} />

          {/* Batch list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900">Batch Stok</h2>
                <span className="text-xs text-gray-400">{batchTotal} batch</span>
              </div>
              <form method="GET" action="/admin/inventory" className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  name="bq"
                  defaultValue={bq}
                  placeholder="Cari batch mengikut nama produk..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fresh-400 bg-gray-50"
                />
                {bq && (
                  <Link
                    href="/admin/inventory"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </Link>
                )}
              </form>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Produk</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Masuk</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Tamat Tempoh</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pembekal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-400">Tiada batch lagi</td>
                  </tr>
                ) : (
                  batches.map((b: any) => {
                    const exp = expiryInfo(b.expiry_date)
                    return (
                      <tr key={b.id} className={`transition-colors ${exp.rowCls || 'hover:bg-gray-50'}`}>
                        <td className="px-5 py-3 font-medium text-gray-800">{b.products?.name}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-bold text-sm ${exp.days < 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                            {b.quantity}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-xs text-gray-500">
                          {new Date(b.batch_date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${exp.cls}`}>
                            {exp.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">{b.supplier ?? '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            </div>
            <Pagination page={batchPage} total={batchTotal} pageSize={BATCH_PAGE_SIZE} basePath="/admin/inventory" />
          </div>
        </div>
      </div>
    </div>
  )
}
