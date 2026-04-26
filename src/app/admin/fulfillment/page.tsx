'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { RefreshCw, Clock, Package, Truck, CheckCircle2, AlertCircle, Phone, Calendar } from 'lucide-react'

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
  profiles: { full_name: string | null; phone: string | null } | null
  order_items: { product_name: string; quantity: number }[]
}

const COLUMNS = [
  {
    status: 'pending',
    label: 'Menunggu',
    headerCls: 'bg-yellow-500',
    cardBorder: 'border-yellow-200',
    icon: Clock,
  },
  {
    status: 'confirmed',
    label: 'Disahkan',
    headerCls: 'bg-blue-500',
    cardBorder: 'border-blue-200',
    icon: CheckCircle2,
  },
  {
    status: 'preparing',
    label: 'Disediakan',
    headerCls: 'bg-purple-500',
    cardBorder: 'border-purple-200',
    icon: Package,
  },
  {
    status: 'delivering',
    label: 'Dihantar',
    headerCls: 'bg-orange-500',
    cardBorder: 'border-orange-200',
    icon: Truck,
  },
]

const ACTION: Record<string, { label: string; next: string; cls: string }> = {
  pending:   { label: '✓ Sahkan Pesanan',  next: 'confirmed',  cls: 'bg-blue-600 hover:bg-blue-700 text-white' },
  confirmed: { label: '▶ Mula Sediakan',   next: 'preparing',  cls: 'bg-purple-600 hover:bg-purple-700 text-white' },
  preparing: { label: '🚗 Hantar Sekarang', next: 'delivering', cls: 'bg-orange-500 hover:bg-orange-600 text-white' },
  delivering:{ label: '✓ Tandakan Selesai',next: 'delivered',   cls: 'bg-green-600 hover:bg-green-700 text-white' },
}

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'baru sahaja'
  if (mins < 60) return `${mins} min lalu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} jam lalu`
  return `${Math.floor(hrs / 24)} hari lalu`
}

export default function FulfillmentPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/fulfillment')
    const data = await res.json()
    setOrders(Array.isArray(data) ? data : [])
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
      toast.error('Gagal kemaskini status')
    } else {
      toast.success(`${order.order_number} — ${action.label}`)
      fetch('/api/notify-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status: action.next }),
      }).catch(() => {})
      load()
    }
    setUpdating(null)
  }

  const byStatus = (status: string) => orders.filter(o => o.status === status)
  const total = orders.length

  return (
    <div className="p-6 min-h-screen bg-gray-50/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fulfillment</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} pesanan aktif
            {lastUpdated && (
              <span className="ml-2 text-gray-300">· dikemaskini {lastUpdated.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}</span>
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
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Memuatkan...
        </div>
      ) : total === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-gray-700 font-semibold text-lg">Semua selesai!</p>
          <p className="text-gray-400 text-sm mt-1">Tiada pesanan aktif pada masa ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
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
      )}
    </div>
  )
}
