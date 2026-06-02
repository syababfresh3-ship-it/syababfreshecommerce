'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { StatusDropdown, PaymentDropdown } from './order-dropdowns'

const PAGE_SIZE = 25

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Pending',       cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed:  { label: 'Confirmed',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  preparing:  { label: 'Preparing',    cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  delivering: { label: 'Delivering',      cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  delivered:  { label: 'Delivered',       cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:  { label: 'Cancelled',       cls: 'bg-red-50 text-red-600 border-red-200' },
  refunded:   { label: 'Refunded', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const methodLabel: Record<string, string> = {
  fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Bank Transfer',
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const time = date.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return { top: 'Today', bottom: time }
  if (isYesterday) return { top: 'Yesterday', bottom: time }
  return { top: date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }), bottom: time }
}

function getActionInfo(order: any): { label: string; color: string; border: string } {
  const method = order.payment_method
  const isPaid = order.payment_status === 'paid' || method === 'cod' || method === 'bank_transfer'
  if (order.status === 'pending' && isPaid)    return { label: '⚡ Confirm orders',    color: 'text-red-600 font-bold',     border: 'border-l-4 border-l-red-400' }
  if (order.status === 'pending' && !isPaid)   return { label: '⏳ Awaiting payment',    color: 'text-yellow-600',            border: 'border-l-4 border-l-yellow-300' }
  if (order.status === 'confirmed')            return { label: '📦 Start preparing',     color: 'text-blue-600 font-semibold', border: 'border-l-4 border-l-blue-400' }
  if (order.status === 'preparing')            return { label: '🚚 Mark as shipped', color: 'text-purple-600 font-semibold', border: 'border-l-4 border-l-purple-400' }
  if (order.status === 'delivering')           return { label: '📍 In transit', color: 'text-orange-500',           border: 'border-l-4 border-l-orange-300' }
  if (order.status === 'delivered')            return { label: '✓ Delivered',            color: 'text-green-600',             border: 'border-l-[3px] border-l-green-200' }
  return { label: '—', color: 'text-gray-400', border: '' }
}

const BULK_STATUSES = [
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'preparing',  label: 'Preparing' },
  { value: 'delivering', label: 'Delivering' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'cancelled',  label: 'Cancelled' },
]

export function OrdersTableClient({ orders, searchQuery }: { orders: any[]; searchQuery?: string }) {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  const totalPages = Math.ceil(orders.length / PAGE_SIZE)
  const pageOrders = useMemo(() => orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [orders, page])

  const pageIds = pageOrders.map(o => o.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  function toggleAll() {
    if (allPageSelected) {
      setSelected(prev => { const next = new Set(prev); pageIds.forEach(id => next.delete(id)); return next })
    } else {
      setSelected(prev => new Set([...prev, ...pageIds]))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function exportCsv() {
    const selectedOrders = orders.filter(o => selected.has(o.id))
    const rows = [
      ['Order No.', 'Customer', 'Phone', 'Status', 'Payment', 'Method', 'Amount (RM)', 'Delivery Slot', 'Date'],
      ...selectedOrders.map(o => [
        o.order_number,
        o.profiles?.full_name ?? '',
        o.profiles?.phone ?? '',
        statusConfig[o.status]?.label ?? o.status,
        o.payment_status,
        methodLabel[o.payment_method] ?? o.payment_method,
        Number(o.total).toFixed(2),
        o.delivery_slot ?? '',
        new Date(o.created_at).toLocaleDateString('en-MY'),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function applyBulkStatus() {
    if (!bulkStatus || selected.size === 0) return
    if (!window.confirm(`Change ${selected.size} orders to "${BULK_STATUSES.find(s => s.value === bulkStatus)?.label}"?`)) return
    setBulkLoading(true)
    let failed = 0
    // Build a map of id → isLp for selected orders
    const lpIds = new Set(orders.filter(o => (o as any)._isLp && selected.has(o.id)).map(o => o.id))
    await Promise.all([...selected].map(async id => {
      const isLp = lpIds.has(id)
      const url = isLp ? '/api/admin/landing-pages/orders' : `/api/admin/orders/${id}`
      const body = isLp ? { id, status: bulkStatus } : { status: bulkStatus }
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) failed++
    }))
    setBulkLoading(false)
    if (failed > 0) toast.error(`${failed} orders failed to update`)
    else toast.success(`${selected.size} orders updated`)
    setSelected(new Set())
    setBulkStatus('')
    router.refresh()
  }

  function changePage(next: number) {
    setPage(next)
    setSelected(new Set())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      {/* Bulk action bar */}
      {someSelected && (
        <div className="sticky top-0 z-20 bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-3 mb-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-gray-900">{selected.size} selected</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Nyahselect
          </button>
          <div className="flex-1" />
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV ({selected.size})
          </button>
          <div className="flex items-center gap-1.5">
            <select
              value={bulkStatus}
              onChange={e => setBulkStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
            >
              <option value="">Tukar status ke...</option>
              {BULK_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button
              onClick={applyBulkStatus}
              disabled={!bulkStatus || bulkLoading}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-gray-900 px-3 py-2 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Terapkan
            </button>
          </div>
        </div>
      )}

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {pageOrders.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-14">
            {searchQuery ? `No orders sepadan "${searchQuery}"` : 'No orders'}
          </p>
        ) : pageOrders.map((order) => {
          const sc = statusConfig[order.status] ?? { label: order.status, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
          const dt = formatDate(order.created_at)
          const action = getActionInfo(order)
          const isSelected = selected.has(order.id)
          return (
            <div key={order.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${action.border} ${isSelected ? 'border-purple-300 ring-1 ring-purple-200' : 'border-gray-100'}`}>
              <div className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(order.id)}
                  onClick={e => e.stopPropagation()}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-300 shrink-0 cursor-pointer"
                />
                <Link href={`/admin/orders/${order.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold text-red-600">{order.order_number}</span>
                    {(order as any)._isLp ? (
                      <span className="text-[9px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">LP</span>
                    ) : (
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Storefront</span>
                    )}
                    {order.delivery_method === 'pickup' && (
                      <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">PICKUP</span>
                    )}
                    <span className={`text-[10px] font-semibold ${action.color}`}>{action.label}</span>
                  </div>
                  {(order as any)._lpTitle && (
                    <span className="inline-block mb-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md truncate max-w-[200px]">
                      🏷 {(order as any)._lpTitle}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-900">{order.profiles?.full_name ?? '—'}</p>
                  {order.profiles?.phone && <p className="text-xs text-gray-400">{order.profiles.phone}</p>}
                  {order.delivery_slot && <p className="text-[10px] text-blue-600 font-medium mt-0.5">🕐 {order.delivery_slot}</p>}
                </Link>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${sc.cls}`}>{sc.label}</span>
                  <span className="font-bold text-gray-900 text-sm">RM{Number(order.total).toFixed(2)}</span>
                  <span className="text-[10px] text-gray-400">{dt.top} {dt.bottom}</span>
                </div>
              </div>
              <div className="px-4 pb-3 border-t border-gray-50 pt-2 flex items-center gap-3">
                <StatusDropdown orderId={order.id} currentStatus={order.status} />
                <PaymentDropdown orderId={order.id} currentStatus={order.payment_status} paymentMethod={order.payment_method} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="pl-5 pr-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-300 cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Order No.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action Required</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center text-gray-400">
                  {searchQuery ? `No orders sepadan "${searchQuery}"` : 'No orders'}
                </td>
              </tr>
            ) : pageOrders.map((order) => {
              const dt = formatDate(order.created_at)
              const action = getActionInfo(order)
              const isSelected = selected.has(order.id)
              return (
                <tr
                  key={order.id}
                  className={`transition-colors cursor-pointer ${action.border} ${isSelected ? 'bg-purple-50/60' : 'hover:bg-gray-50/60'}`}
                  onClick={() => router.push((order as any)._isLp ? `/admin/orders/lp/${order.id}` : `/admin/orders/${order.id}`)}
                >
                  <td className="pl-5 pr-3 py-3.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(order.id)}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-sm text-red-600 hover:underline font-bold">
                        {order.order_number}
                      </Link>
                      {(order as any)._isLp ? (
                        <span className="text-xs font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">LP</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Storefront</span>
                      )}
                      {order.delivery_method === 'pickup' && (
                        <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">PICKUP</span>
                      )}
                    </div>
                    {(order as any)._lpTitle && (
                      <span className="inline-block mt-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md truncate max-w-[200px]" title={(order as any)._lpTitle}>
                        🏷 {(order as any)._lpTitle}
                      </span>
                    )}
                    {order.delivery_slot && (
                      <span className="text-xs text-blue-600 mt-0.5 block">🕐 {order.delivery_slot}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-sm font-semibold text-gray-900">{order.profiles?.full_name ?? '—'}</div>
                    {order.profiles?.phone && (
                      <a href={`tel:${order.profiles.phone}`} className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                        {order.profiles.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-sm ${action.color}`}>{action.label}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                    <StatusDropdown orderId={order.id} currentStatus={order.status} />
                    <div className="text-xs text-gray-400 mt-1">{methodLabel[order.payment_method] ?? ''}</div>
                  </td>
                  <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                    <PaymentDropdown orderId={order.id} currentStatus={order.payment_status} paymentMethod={order.payment_method} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-bold text-gray-900">RM{Number(order.total).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-medium text-gray-600 block">{dt.top}</span>
                    <span className="text-xs text-gray-400">{dt.bottom}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-400">
            Page <span className="font-bold text-gray-700">{page}</span> dari <span className="font-bold text-gray-700">{totalPages}</span>
            <span className="ml-1">· {orders.length} records</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => changePage(page - 1)}
              disabled={page === 1}
              className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Sebelum
            </button>
            {/* Page numbers — show max 5 */}
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} className="w-8 text-center text-xs text-gray-400 py-2">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => changePage(p as number)}
                      className={`w-8 h-8 text-xs font-semibold rounded-xl transition-colors ${
                        p === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
            </div>
            <button
              onClick={() => changePage(page + 1)}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
