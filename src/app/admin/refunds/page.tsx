'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Download, BarChart2, RotateCcw, AlertTriangle } from 'lucide-react'
import { PAYMENT_LABELS, STATUS_LABELS } from '@/lib/refund-calc'
import type { RefundPaymentMethod, RefundStatus } from '@/lib/refund-calc'

interface RefundRow {
  id: string
  created_at: string
  deadline: string
  resolved_at: string | null
  order_number: string | null
  customer_name: string | null
  customer_phone: string | null
  jumlah_refund: number
  payment_method: RefundPaymentMethod
  status: RefundStatus
  supplier_code: string | null
}

const TABS: { key: '' | RefundStatus; label: string }[] = [
  { key: '', label: 'Semua' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Dalam Proses' },
  { key: 'selesai', label: 'Selesai' },
]

const statusStyle: Record<RefundStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  selesai: 'bg-green-100 text-green-700',
}

export default function AdminRefundsPage() {
  const [status, setStatus] = useState<'' | RefundStatus>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<RefundRow[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    params.set('page', String(page))
    const res = await fetch(`/api/admin/refunds?${params}`)
    const data = await res.json()
    setRows(data.refunds ?? [])
    setTotal(data.total ?? 0)
    setPages(data.pages ?? 1)
    setLoading(false)
  }, [status, search, page])

  useEffect(() => { load() }, [load])

  const exportUrl = `/api/admin/refunds/export${status ? `?status=${status}` : ''}`

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Refund</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} rekod refund</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/refunds/analytics" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <BarChart2 className="h-4 w-4" /> Analytics
          </Link>
          <a href={exportUrl} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export
          </a>
          <Link href="/admin/refunds/new" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm">
            <Plus className="h-4 w-4" /> Refund Baru
          </Link>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setStatus(t.key); setPage(1) }}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${status === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari no order / nama / telefon / tracking…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/30 focus:border-red-400 outline-none" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Memuatkan…</div>
      ) : rows.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl px-6 py-12 text-center">
          <RotateCcw className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Tiada refund dijumpai.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const overdue = r.status !== 'selesai' && new Date(r.deadline) < new Date()
            return (
              <Link key={r.id} href={`/admin/refunds/${r.id}`}
                className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-red-200 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-sm font-bold text-gray-900">{r.order_number ?? '-'}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                      {overdue && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{r.customer_name ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {PAYMENT_LABELS[r.payment_method]} · {new Date(r.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                      {r.supplier_code ? ` · Supplier ${r.supplier_code}` : ''}
                    </p>
                  </div>
                  <p className="text-xl font-black text-gray-900 shrink-0">RM{Number(r.jumlah_refund).toFixed(2)}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">‹ Prev</button>
          <span className="text-sm text-gray-500">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next ›</button>
        </div>
      )}
    </div>
  )
}
