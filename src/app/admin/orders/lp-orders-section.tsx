'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Phone, MessageCircle, Pencil, X, Check } from 'lucide-react'

interface LpOrder {
  id: string
  order_number: string
  name: string
  phone: string
  address: string
  postcode?: string | null
  notes?: string | null
  status: string
  payment_status?: string
  total: number
  payment_method: string
  delivery_fee: number
  created_at: string
  items: any[]
  product_name: string
  variant_name: string | null
  quantity: number
  unit_price: number
  landing_pages: { title: string; slug: string } | null
}

const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  pending:    { next: 'confirmed',  label: '✓ Confirm',    color: 'bg-rose-600 text-white hover:bg-rose-700' },
  confirmed:  { next: 'preparing', label: '▶ Start Prep',  color: 'bg-purple-600 text-white hover:bg-purple-700' },
  preparing:  { next: 'delivering',label: '🚚 Ship Now',   color: 'bg-orange-500 text-white hover:bg-orange-600' },
  delivering: { next: 'delivered', label: '✓ Delivered',   color: 'bg-green-600 text-white hover:bg-green-700' },
}

const STATUS_BADGE: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  preparing:  'bg-purple-100 text-purple-700',
  delivering: 'bg-orange-100 text-orange-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-600',
}

const payLabel: Record<string, string> = { fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Bank Transfer' }

function EditModal({ order, onClose, onSaved }: { order: LpOrder; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: order.name, phone: order.phone, address: order.address, postcode: order.postcode ?? '', notes: order.notes ?? '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/landing-pages/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id, ...form }),
    })
    if (!res.ok) toast.error('Failed to save')
    else { toast.success('Customer details updated'); onSaved(); onClose() }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-900">Edit Customer — {order.order_number}</p>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="h-4 w-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">NAME</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">PHONE</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">ADDRESS</label>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none" rows={3} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">POSTCODE</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">NOTES</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <Check className="h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LpOrdersSection({ lpOrders, onUpdate }: { lpOrders: LpOrder[]; onUpdate?: () => void }) {
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)
  const [editOrder, setEditOrder] = useState<LpOrder | null>(null)

  function refresh() { router.refresh(); onUpdate?.() }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    const res = await fetch('/api/admin/landing-pages/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) { toast.error('Failed to update'); setUpdating(null); return }
    toast.success(`Status → ${status}`)
    // Send WA to customer
    fetch('/api/admin/landing-pages/notify-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: id, status }),
    }).catch(() => {})
    refresh()
    setUpdating(null)
  }

  function waCustomer(order: LpOrder) {
    let phone = order.phone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '6' + phone
    if (!phone.startsWith('60')) phone = '60' + phone
    const msg = encodeURIComponent(`Hi ${order.name}, regarding your order ${order.order_number} — `)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener')
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {lpOrders.map(lp => {
          const items: any[] = Array.isArray(lp.items) && lp.items.length > 0
            ? lp.items
            : [{ product_name: lp.product_name, variant_name: lp.variant_name, quantity: lp.quantity, unit_price: lp.unit_price }]
          const isOnline = lp.payment_method === 'fpx' || lp.payment_method === 'ewallet'
          const isPaid = isOnline && lp.payment_status === 'paid'
          const nextAction = STATUS_FLOW[lp.status]

          return (
            <div key={lp.id} className="bg-white rounded-2xl border-2 border-rose-100 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-rose-50 px-4 py-2 flex items-center justify-between border-b border-rose-100">
                <span className="text-xs font-bold text-rose-700 truncate max-w-[60%]">{lp.landing_pages?.title ?? 'LP'}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isPaid ? '✓ Paid' : isOnline ? 'Belum Bayar' : payLabel[lp.payment_method] ?? lp.payment_method}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[lp.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {lp.status}
                  </span>
                </div>
              </div>

              <div className="px-4 py-3 space-y-2">
                {/* Order number + total */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-rose-600">{lp.order_number}</span>
                  <span className="text-sm font-black text-gray-900">RM{Number(lp.total).toFixed(2)}</span>
                </div>

                {/* Customer */}
                <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{lp.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">{lp.phone}</span>
                    </div>
                    {lp.address && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{lp.address}{lp.postcode ? `, ${lp.postcode}` : ''}</p>}
                  </div>
                  <button onClick={() => setEditOrder(lp)} className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0" title="Edit details">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Items */}
                <div className="space-y-0.5">
                  {items.slice(0, 2).map((item: any, i: number) => (
                    <p key={i} className="text-xs text-gray-600">• {item.product_name}{item.variant_name ? ` (${item.variant_name})` : ''} ×{item.quantity}</p>
                  ))}
                  {items.length > 2 && <p className="text-[10px] text-gray-400">+{items.length - 2} more</p>}
                </div>

                {lp.notes && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">📝 {lp.notes}</p>}

                <p className="text-[10px] text-gray-400">
                  {new Date(lp.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => waCustomer(lp)} className="p-1.5 text-[#25D366] hover:bg-green-50 rounded-lg transition-colors shrink-0" title="WhatsApp">
                    <MessageCircle className="h-4 w-4" />
                  </button>

                  {lp.status !== 'delivered' && lp.status !== 'cancelled' && (
                    <button
                      onClick={() => updateStatus(lp.id, 'cancelled')}
                      disabled={updating === lp.id}
                      className="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >Cancel</button>
                  )}

                  {nextAction && (
                    <button
                      onClick={() => updateStatus(lp.id, nextAction.next)}
                      disabled={updating === lp.id}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-xl disabled:opacity-50 transition-colors ${nextAction.color}`}
                    >{updating === lp.id ? '...' : nextAction.label}</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {editOrder && (
        <EditModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={refresh}
        />
      )}
    </>
  )
}
