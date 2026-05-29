'use client'

import { useEffect, useState } from 'react'
import { X, Phone, MapPin, MessageCircle, Package, ChevronRight, Loader2, ExternalLink } from 'lucide-react'
import { StatusDropdown, PaymentDropdown } from './order-dropdowns'

interface OrderDetail {
  id: string
  order_number: string
  status: string
  total: number
  payment_status: string
  payment_method: string
  delivery_address: string | null
  delivery_slot: string | null
  notes: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
  order_items: { id: string; product_name: string; variant_name: string | null; quantity: number; unit_price: number; subtotal: number }[]
  profiles: { full_name: string | null; phone: string | null; email: string | null } | null
}

const statusTimeline = [
  { key: 'pending',    label: 'Pending',    color: 'bg-yellow-400' },
  { key: 'confirmed',  label: 'Confirmed',   color: 'bg-blue-500' },
  { key: 'preparing',  label: 'Preparing',  color: 'bg-purple-500' },
  { key: 'delivering', label: 'Shipped',    color: 'bg-orange-500' },
  { key: 'delivered',  label: 'Delivered',   color: 'bg-green-500' },
]

const methodLabel: Record<string, string> = {
  fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Bank Transfer',
}

interface Props {
  orderId: string | null
  onClose: () => void
  onUpdate: () => void
}

export function OrderSidePanel({ orderId, onClose, onUpdate }: Props) {
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) { setOrder(null); return }
    setLoading(true)
    fetch(`/api/admin/orders/${orderId}`)
      .then(r => r.json())
      .then(d => setOrder(d))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false))
  }, [orderId])

  function waCustomer() {
    if (!order?.profiles?.phone) return
    let phone = order.profiles.phone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '6' + phone
    if (!phone.startsWith('60')) phone = '60' + phone
    const msg = encodeURIComponent(`Hi ${order.profiles.full_name ?? 'Customer'}, regarding your order ${order.order_number} — `)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener')
  }

  const currentStep = statusTimeline.findIndex(s => s.key === order?.status)

  return (
    <>
      {/* Overlay */}
      {orderId && (
        <div className="fixed inset-0 z-30 bg-black/20 md:bg-transparent" onClick={onClose} />
      )}

      {/* Panel */}
      <div className={`fixed top-0 right-0 h-full w-full md:w-[420px] bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-out ${
        orderId ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            {order && (
              <>
                <p className="font-black font-mono text-gray-900 text-base">{order.order_number}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(order.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {order && (
              <a href={`/admin/orders/${order.id}`} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Open full page">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        )}

        {!loading && order && (
          <div className="flex-1 overflow-y-auto">
            {/* Status timeline */}
            <div className="px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-1">
                {statusTimeline.map((step, i) => {
                  const done = i <= currentStep
                  const current = i === currentStep
                  return (
                    <div key={step.key} className="flex items-center flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-all ${
                        done ? `${step.color} text-white shadow-sm` : 'bg-gray-100 text-gray-400'
                      } ${current ? 'ring-2 ring-offset-1 ring-current scale-110' : ''}`}>
                        {done && !current ? '✓' : i + 1}
                      </div>
                      {i < statusTimeline.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 rounded-full ${i < currentStep ? step.color : 'bg-gray-100'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-gray-700">{statusTimeline[currentStep]?.label ?? order.status}</span>
                <div className="flex items-center gap-2">
                  <StatusDropdown orderId={order.id} currentStatus={order.status} onUpdate={() => { onUpdate(); fetch(`/api/admin/orders/${orderId}`).then(r => r.json()).then(setOrder) }} />
                  <PaymentDropdown orderId={order.id} currentStatus={order.payment_status} paymentMethod={order.payment_method} onUpdate={() => { onUpdate(); fetch(`/api/admin/orders/${orderId}`).then(r => r.json()).then(setOrder) }} />
                </div>
              </div>
            </div>

            {/* Customer */}
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Customer</p>
              <p className="font-bold text-gray-900">{order.profiles?.full_name ?? '—'}</p>
              {order.profiles?.phone && (
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <span className="text-sm text-gray-600">{order.profiles.phone}</span>
                </div>
              )}
              {order.delivery_address && (
                <div className="flex items-start gap-2 mt-1.5">
                  <MapPin className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-gray-500 leading-relaxed">{order.delivery_address}</span>
                </div>
              )}
              {order.delivery_slot && (
                <p className="text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5 mt-2 inline-block">
                  🕐 {order.delivery_slot}
                </p>
              )}
            </div>

            {/* Items */}
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                <Package className="h-3 w-3 inline mr-1" />Items
              </p>
              <div className="space-y-2.5">
                {(order.order_items ?? []).map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{item.product_name}</p>
                      {item.variant_name && <p className="text-xs text-gray-400">{item.variant_name}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">RM{Number(item.subtotal ?? item.unit_price * item.quantity).toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400">×{item.quantity} · RM{Number(item.unit_price).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="px-5 py-4 border-b border-gray-50">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>RM{(order.order_items ?? []).reduce((s, i) => s + Number(i.subtotal ?? i.unit_price * i.quantity), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-gray-900 text-base border-t border-gray-100 pt-1.5 mt-1">
                  <span>Total</span>
                  <span>RM{Number(order.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Payment</span>
                  <span className={`font-semibold ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                    {methodLabel[order.payment_method] ?? order.payment_method} · {order.payment_status === 'paid' ? 'Paid ✓' : 'Unpaid'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {(order.notes || order.admin_notes) && (
              <div className="px-5 py-4 border-b border-gray-50 space-y-2">
                {order.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-bold text-amber-600 mb-1">Customer Note</p>
                    <p className="text-xs text-amber-800">{order.notes}</p>
                  </div>
                )}
                {order.admin_notes && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-bold text-red-600 mb-1">Admin Note</p>
                    <p className="text-xs text-red-800">{order.admin_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-4 space-y-2">
              <button
                onClick={waCustomer}
                disabled={!order.profiles?.phone}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-bold hover:bg-green-600 disabled:opacity-40 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp Customer
              </button>
              <a
                href={`/admin/orders/${order.id}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
              >
                Full Order Details
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
