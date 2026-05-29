'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { RefreshCw, Clock, Package, Truck, CheckCircle2, AlertCircle, Phone, Calendar, ShieldAlert, Tag } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  status: string
  total: number
  payment_method: string
  payment_status: string
  created_at: string
  notes: string | null
  delivery_slot: string | null
  needs_approval: boolean
  profiles: { full_name: string | null; phone: string | null } | null
  order_items: { product_name: string; quantity: number }[]
}

interface LpOrder {
  id: string
  order_number: string
  status: string
  total: number
  payment_method: string
  name: string
  phone: string
  address: string
  product_name: string
  variant_name: string | null
  quantity: number
  unit_price: number
  items: any[]
  created_at: string
  notes: string | null
  landing_pages: { title: string; slug: string } | null
}

const COLUMNS = [
  {
    status: 'pending',
    label: 'Pending',
    headerCls: 'bg-yellow-500',
    cardBorder: 'border-yellow-200',
    icon: Clock,
  },
  {
    status: 'confirmed',
    label: 'Confirmed',
    headerCls: 'bg-blue-500',
    cardBorder: 'border-blue-200',
    icon: CheckCircle2,
  },
  {
    status: 'preparing',
    label: 'Preparing',
    headerCls: 'bg-purple-500',
    cardBorder: 'border-purple-200',
    icon: Package,
  },
  {
    status: 'delivering',
    label: 'Delivering',
    headerCls: 'bg-orange-500',
    cardBorder: 'border-orange-200',
    icon: Truck,
  },
]

const ACTION: Record<string, { label: string; next: string; cls: string }> = {
  pending:   { label: '✓ Confirm Order',  next: 'confirmed',  cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
  confirmed: { label: '▶ Start Preparing',   next: 'preparing',  cls: 'bg-purple-600 hover:bg-purple-700 text-white' },
  preparing: { label: '🚗 Ship Now', next: 'delivering', cls: 'bg-orange-500 hover:bg-orange-600 text-white' },
  delivering:{ label: '✓ Mark Delivered',next: 'delivered',   cls: 'bg-green-600 hover:bg-green-700 text-white' },
}

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return `${Math.floor(hrs / 24)} d ago`
}

export default function FulfillmentPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [lpOrders, setLpOrders] = useState<LpOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [trackingLinks, setTrackingLinks] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const [mainRes, lpRes] = await Promise.all([
      fetch('/api/admin/fulfillment'),
      fetch('/api/admin/landing-pages/orders?status=pending'),
    ])
    const [mainData, lpData] = await Promise.all([mainRes.json(), lpRes.json()])
    setOrders(Array.isArray(mainData) ? mainData : [])
    setLpOrders(Array.isArray(lpData) ? lpData : [])
    setLoading(false)
    setLastUpdated(new Date())
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  async function advance(order: Order) {
    const action = ACTION[order.status]
    if (!action) return
    setUpdating(order.id)
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action.next }),
    })
    if (!res.ok) {
      toast.error('Failed to update status')
    } else {
      toast.success(`${order.order_number} — ${action.label}`)
      const trackingUrl = order.status === 'preparing' ? (trackingLinks[order.id] ?? '').trim() : ''
      fetch('/api/notify-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status: action.next, trackingUrl: trackingUrl || undefined }),
      }).then(async r => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) console.error('[notify-customer] failed:', r.status, body)
        else console.log('[notify-customer] ok:', body)
      }).catch(err => console.error('[notify-customer] fetch error:', err))
      if (trackingUrl) {
        setTrackingLinks(prev => { const next = { ...prev }; delete next[order.id]; return next })
      }
      load()
    }
    setUpdating(null)
  }

  async function approveOrder(order: Order) {
    setUpdating(order.id)
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (!res.ok) toast.error('Failed to approve order')
    else { toast.success(`${order.order_number} — Approved!`); load() }
    setUpdating(null)
  }

  async function rejectOrder(order: Order) {
    if (!confirm(`Cancel order ${order.order_number}? This will cancel the order.`)) return
    setUpdating(order.id)
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    })
    if (!res.ok) toast.error('Failed to reject order')
    else { toast.success(`${order.order_number} — Rejected`); load() }
    setUpdating(null)
  }

  async function advanceLp(lpOrder: LpOrder, newStatus: 'confirmed' | 'cancelled') {
    setUpdating(lpOrder.id)
    const res = await fetch('/api/admin/landing-pages/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lpOrder.id, status: newStatus }),
    })
    if (!res.ok) toast.error('Failed to update')
    else { toast.success(`${lpOrder.order_number} — ${newStatus === 'confirmed' ? 'Confirmed ✓' : 'Cancelled'}`); load() }
    setUpdating(null)
  }

  const pendingApproval = orders.filter(o => o.needs_approval)
  const byStatus = (status: string) => orders.filter(o => !o.needs_approval && o.status === status)
  const total = orders.length + lpOrders.length

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fulfillment</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} active orders
            {lastUpdated && (
              <span className="ml-2 text-gray-300">· updated {lastUpdated.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      ) : total === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-gray-700 font-semibold text-lg">All done!</p>
          <p className="text-gray-400 text-sm mt-1">Tiada active orders pada masa ini.</p>
        </div>
      ) : (
        <>
        {/* ── LP Orders — Preorder pending ── */}
        {lpOrders.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-rose-600 shadow-sm mb-3">
              <Tag className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white flex-1">Landing Page Orders</span>
              <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">{lpOrders.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {lpOrders.map(lp => {
                const items: any[] = Array.isArray(lp.items) && lp.items.length > 0
                  ? lp.items
                  : [{ product_name: lp.product_name, variant_name: lp.variant_name, quantity: lp.quantity, unit_price: lp.unit_price }]
                const payLabel: Record<string, string> = { fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Pindahan Bank' }
                const isPaid = lp.payment_method === 'fpx' || lp.payment_method === 'ewallet'
                return (
                  <div key={lp.id} className="bg-white rounded-2xl border-2 border-rose-200 shadow-sm overflow-hidden">
                    <div className="bg-rose-50 px-4 py-2 flex items-center justify-between border-b border-rose-100">
                      <span className="text-xs font-bold text-rose-700 truncate">{lp.landing_pages?.title ?? 'LP'}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isPaid ? '✓ Paid' : payLabel[lp.payment_method] ?? lp.payment_method}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-rose-600">{lp.order_number}</span>
                        <span className="text-sm font-black text-gray-900">RM{Number(lp.total).toFixed(2)}</span>
                      </div>
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-sm font-bold text-gray-900">{lp.name}</p>
                        <a href={`tel:${lp.phone}`} className="flex items-center gap-1 text-xs text-blue-600 mt-0.5">
                          <Phone className="h-3 w-3" />{lp.phone}
                        </a>
                      </div>
                      <div className="space-y-0.5">
                        {items.slice(0, 3).map((item: any, i: number) => (
                          <p key={i} className="text-xs text-gray-600">• {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} ×{item.quantity}</p>
                        ))}
                      </div>
                      {lp.notes && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">📝 {lp.notes}</p>}
                      <p className="text-[10px] text-gray-400">{timeAgo(lp.created_at)}</p>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => advanceLp(lp, 'cancelled')}
                          disabled={updating === lp.id}
                          className="flex-1 py-2 text-xs font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50"
                        >Cancel</button>
                        <button
                          onClick={() => advanceLp(lp, 'confirmed')}
                          disabled={updating === lp.id}
                          className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50"
                        >{updating === lp.id ? '...' : '✓ Confirm'}</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Perlu Lulus — First-order approval queue ── */}
        {pendingApproval.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-500 shadow-sm mb-3">
              <ShieldAlert className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white flex-1">Needs Approval — New Customer</span>
              <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingApproval.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingApproval.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2 flex items-center gap-2 border-b border-amber-100">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-700">First Order — Review Before Approving</span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/admin/orders/${order.id}`} className="text-xs font-mono font-bold text-red-600 hover:underline">
                        {order.order_number}
                      </Link>
                      <span className="text-sm font-black text-gray-900">RM{Number(order.total).toFixed(2)}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{order.profiles?.full_name ?? '—'}</p>
                      {order.profiles?.phone && (
                        <a href={`tel:${order.profiles.phone}`} className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" />{order.profiles.phone}
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {order.order_items.slice(0, 3).map((item, i) => (
                        <p key={i}>• {item.product_name} ×{item.quantity}</p>
                      ))}
                      {order.order_items.length > 3 && <p className="text-gray-400">+{order.order_items.length - 3} lagi</p>}
                    </div>
                    <p className="text-[10px] text-gray-400">{timeAgo(order.created_at)} · {order.payment_method.toUpperCase()}</p>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => rejectOrder(order)}
                        disabled={updating === order.id}
                        className="flex-1 py-2 text-xs font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                      <button
                        onClick={() => approveOrder(order)}
                        disabled={updating === order.id}
                        className="flex-1 py-2 text-xs font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 disabled:opacity-50"
                      >
                        {updating === order.id ? '...' : '✓ Lulus'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Kanban columns ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colOrders = byStatus(col.status)
            const Icon = col.icon
            return (
              <div key={col.status} className="flex flex-col gap-3">
                {/* Column header */}
                <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl ${col.headerCls} shadow-sm`}>
                  <Icon className="h-4 w-4 text-white" />
                  <span className="text-sm font-bold text-white flex-1">{col.label}</span>
                  <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {colOrders.length}
                  </span>
                </div>

                {/* Empty state */}
                {colOrders.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl py-10 text-center">
                    <p className="text-xs text-gray-400">Tiada pesanan</p>
                  </div>
                ) : (
                  colOrders.map(order => {
                    const waitMins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                    const isUrgent = order.status === 'pending' && waitMins > 10
                    const isCOD = order.payment_method === 'cod'
                    const isUnpaid = order.payment_status === 'unpaid' && !isCOD
                    const action = ACTION[order.status]

                    return (
                      <div
                        key={order.id}
                        className={`bg-white rounded-2xl border-2 shadow-sm flex flex-col gap-3 overflow-hidden transition-all ${
                          isUrgent ? 'border-red-400 shadow-red-100' : col.cardBorder
                        }`}
                      >
                        {/* Urgent banner */}
                        {isUrgent && (
                          <div className="bg-red-500 flex items-center gap-2 px-4 py-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-white shrink-0" />
                            <span className="text-xs font-bold text-white">Menunggu {waitMins} minit!</span>
                          </div>
                        )}

                        <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
                          {/* Order number + amount */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="text-xs font-mono font-bold text-red-600 hover:underline"
                              >
                                {order.order_number}
                              </Link>
                              <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(order.created_at)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-base font-black text-gray-900">RM{Number(order.total).toFixed(2)}</p>
                              {isUnpaid && (
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                  Belum Bayar
                                </span>
                              )}
                              {isCOD && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  COD
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Customer */}
                          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                            <p className="text-sm font-bold text-gray-900 leading-tight">
                              {order.profiles?.full_name ?? '—'}
                            </p>
                            {order.profiles?.phone && (
                              <a
                                href={`tel:${order.profiles.phone}`}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5 font-medium"
                              >
                                <Phone className="h-3 w-3" />
                                {order.profiles.phone}
                              </a>
                            )}
                          </div>

                          {/* Delivery slot */}
                          {order.delivery_slot && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              {order.delivery_slot}
                            </div>
                          )}

                          {/* Items */}
                          <div className="space-y-1">
                            {order.order_items.slice(0, 4).map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 truncate">{item.product_name}</span>
                                <span className="font-bold text-gray-900 ml-2 shrink-0">×{item.quantity}</span>
                              </div>
                            ))}
                            {order.order_items.length > 4 && (
                              <p className="text-[11px] text-gray-400">+{order.order_items.length - 4} item lagi</p>
                            )}
                          </div>

                          {/* Notes */}
                          {order.notes && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                              <p className="text-xs text-amber-800 leading-snug">📝 {order.notes}</p>
                            </div>
                          )}

                          {/* Lalamove link input (only for preparing → delivering) */}
                          {order.status === 'preparing' && (
                            <div>
                              <input
                                type="url"
                                placeholder="Lalamove Link (optional)"
                                value={trackingLinks[order.id] ?? ''}
                                onChange={e => setTrackingLinks(prev => ({ ...prev, [order.id]: e.target.value }))}
                                className="w-full border border-orange-200 bg-orange-50 rounded-xl px-3 py-2 text-xs placeholder:text-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                              />
                              {(trackingLinks[order.id] ?? '').trim() && (
                                <p className="text-[10px] text-orange-500 mt-1 px-1">✓ Link will be sent to customer via WhatsApp</p>
                              )}
                            </div>
                          )}

                          {/* Action button */}
                          {action && (
                            <button
                              onClick={() => advance(order)}
                              disabled={updating === order.id}
                              className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 shadow-sm ${action.cls}`}
                            >
                              {updating === order.id ? 'Kemaskini...' : action.label}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}
