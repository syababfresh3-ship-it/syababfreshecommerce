'use client'

import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'

type Product = { id: string; name: string }
type StockMap = Record<string, number>

const FILTERS = [
  { value: 'all',  label: 'All' },
  { value: 'out',  label: 'Habis' },
  { value: 'low',  label: 'Stock Rendah' },
  { value: 'ok',   label: 'OK' },
] as const
type Filter = typeof FILTERS[number]['value']

const PER_PAGE = 30

export function StockSemasa({ products, stockMap }: { products: Product[]; stockMap: StockMap }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return products.filter(p => {
      const stock = stockMap[p.id] ?? 0
      const matchQ = p.name.toLowerCase().includes(q.toLowerCase())
      const matchF =
        filter === 'all' ? true :
        filter === 'out' ? stock === 0 :
        filter === 'low' ? stock > 0 && stock <= 10 :
        stock > 10
      return matchQ && matchF
    })
  }, [products, stockMap, q, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const paged      = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  function handleFilter(f: Filter) {
    setFilter(f)
    setPage(1)
  }

  function handleSearch(val: string) {
    setQ(val)
    setPage(1)
  }

  const counts = useMemo(() => ({
    all: products.length,
    out: products.filter(p => (stockMap[p.id] ?? 0) === 0).length,
    low: products.filter(p => { const s = stockMap[p.id] ?? 0; return s > 0 && s <= 10 }).length,
    ok:  products.filter(p => (stockMap[p.id] ?? 0) > 10).length,
  }), [products, stockMap])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900">Stock Semasa</h2>
          <span className="text-xs text-gray-400">{filtered.length} / {products.length} product</span>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            value={q}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search product..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fresh-400 bg-gray-50"
          />
          {q && (
            <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilter(f.value)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors border ${
                filter === f.value
                  ? f.value === 'out' ? 'bg-red-500 text-white border-red-500'
                  : f.value === 'low' ? 'bg-yellow-500 text-white border-yellow-500'
                  : f.value === 'ok'  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
              <span className="ml-1 opacity-70">({counts[f.value]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-50">
        {paged.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">
            {q ? `No product sepadan "${q}"` : 'No product'}
          </p>
        ) : paged.map(p => {
          const stock   = stockMap[p.id] ?? 0
          const isEmpty = stock === 0
          const isLow   = stock > 0 && stock <= 10
          return (
            <div key={p.id} className={`flex items-center px-5 py-3 gap-4 ${isEmpty ? 'bg-red-50/40' : isLow ? 'bg-yellow-50/40' : 'hover:bg-gray-50'}`}>
              <div className={`h-2 w-2 rounded-full shrink-0 ${isEmpty ? 'bg-red-500' : isLow ? 'bg-yellow-400' : 'bg-green-400'}`} />
              <span className="flex-1 text-sm font-medium text-gray-800">{p.name}</span>
              {isEmpty ? (
                <span className="text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg">Habis</span>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-20 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${isLow ? 'bg-yellow-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.min(100, (stock / 100) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border min-w-[60px] text-center ${
                    isLow ? 'text-yellow-700 bg-yellow-100 border-yellow-200' : 'text-green-700 bg-green-100 border-green-200'
                  }`}>
                    {stock} unit
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">{filtered.length} product · halaman {safePage}/{totalPages}</p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
