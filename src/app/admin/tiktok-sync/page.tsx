'use client'

import { useState, useMemo } from 'react'
import { RefreshCw, Search, Users, ShoppingBag, TrendingUp, Phone, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface TiktokCustomer {
  phone: string
  name: string
  order_count: number
  total_spend: number
  last_order_at: string
  orders: { id: string; total: number; status: string; created_at: string; items: { productName: string; variation?: string; quantity: number }[] }[]
}

interface SyncData {
  customers: TiktokCustomer[]
  total_customers: number
  total_orders: number
  synced_at: string
}

export default function TiktokSyncPage() {
  const [data, setData] = useState<SyncData | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  async function sync() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tiktok-sync')
      const text = await res.text()
      if (!text) { toast.error('Empty response from server'); return }
      const json = JSON.parse(text)
      if (!res.ok) { toast.error(json.error ?? 'Sync failed'); return }
      setData(json)
      toast.success(`Synced ${json.total_customers} customers from TikTok ops`)
    } finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data.customers
    const q = search.toLowerCase()
    return data.customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    )
  }, [data, search])

  const totalRevenue = data?.customers.reduce((s, c) => s + c.total_spend, 0) ?? 0
  const totalOrders = data?.total_orders ?? 0

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-lg">🛍️</span> TikTok Customers Sync
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Sync TikTok order customers from ops system to view cross-channel data
          </p>
          {data && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last synced: {new Date(data.synced_at).toLocaleString('en-MY')}
            </p>
          )}
        </div>
        <button
          onClick={sync}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {!data && !loading && (
        <div className="text-center py-24 text-gray-400">
          <span className="text-5xl block mb-4">🛍️</span>
          <p className="font-semibold text-gray-600 mb-2">No data yet</p>
          <p className="text-sm mb-6">Click "Sync Now" to pull TikTok customer data from the ops system</p>
          <button onClick={sync} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800">
            Start Sync
          </button>
        </div>
      )}

      {data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 mb-1"><Users className="h-3.5 w-3.5 inline mr-1" />Customers</p>
              <p className="text-xl font-black text-gray-900">{data.total_customers}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 mb-1"><ShoppingBag className="h-3.5 w-3.5 inline mr-1" />Orders</p>
              <p className="text-xl font-black text-gray-900">{totalOrders}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 mb-1"><TrendingUp className="h-3.5 w-3.5 inline mr-1" />Revenue</p>
              <p className="text-xl font-black text-gray-900">RM{totalRevenue.toFixed(0)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Avg per Customer</p>
              <p className="text-xl font-black text-gray-900">
                {data.total_customers > 0 ? `RM${(totalRevenue / data.total_customers).toFixed(0)}` : '—'}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4 w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or phone..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white" />
          </div>

          {/* Customer list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Orders</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Spend</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Order</th>
                  <th className="px-5 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">No results</td></tr>
                ) : filtered.map(c => (
                  <>
                    <tr key={c.phone}
                      className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === c.phone ? null : c.phone)}
                    >
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{c.name}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-sm text-gray-600 font-mono">{c.phone}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{c.order_count}</td>
                      <td className="px-5 py-3.5 text-right font-black text-gray-900">RM{c.total_spend.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-right text-xs text-gray-400">
                        {new Date(c.last_order_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">
                        {expanded === c.phone ? '▲' : '▼'}
                      </td>
                    </tr>
                    {expanded === c.phone && (
                      <tr key={`${c.phone}-detail`} className="bg-gray-50/50">
                        <td colSpan={6} className="px-5 py-3">
                          <div className="space-y-2">
                            {c.orders.map(o => (
                              <div key={o.id} className="flex items-start justify-between text-xs bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                                <div>
                                  <span className="font-mono font-bold text-gray-700 mr-2">#{o.id}</span>
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    o.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                                    o.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                                    'bg-yellow-100 text-yellow-700'
                                  }`}>{o.status}</span>
                                  <div className="text-gray-500 mt-1">
                                    {o.items.map((i, idx) => (
                                      <span key={idx}>{i.productName}{i.variation ? ` (${i.variation})` : ''} ×{i.quantity}{idx < o.items.length - 1 ? ', ' : ''}</span>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right shrink-0 ml-4">
                                  <p className="font-bold text-gray-900">RM{o.total.toFixed(2)}</p>
                                  <p className="text-gray-400">{new Date(o.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            {filtered.length} of {data.total_customers} customers shown ·
            <a href="https://manage.syababfresh.my" target="_blank" rel="noopener noreferrer"
              className="ml-1 text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
              Open Ops App <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </>
      )}
    </div>
  )
}
