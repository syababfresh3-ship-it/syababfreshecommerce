'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Search, Check, MessageCircle, RefreshCw } from 'lucide-react'

interface Variant { id: string; name: string; price: number; is_active: boolean; sort_order: number }
interface Product { id: string; name: string; slug: string; price: number; image_url: string | null; product_variants: Variant[] }
interface OrderItem { product_id: string; variant_id: string | null; product_name: string; variant_name: string | null; qty: number; unit_price: number }

const payOptions = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cod', label: 'Cash On Delivery' },
  { value: 'fpx', label: 'FPX (already paid)' },
  { value: 'ewallet', label: 'E-Wallet (already paid)' },
]

export default function QuickOrderPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [items, setItems] = useState<OrderItem[]>([])
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', postcode: '', notes: '', payment_method: 'bank_transfer', staff_name: '', discount: '' })
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null)
  const [fetchingFee, setFetchingFee] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ order_number: string; total: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/landing-pages/products').then(r => r.json()).then(setProducts).catch(() => {})
  }, [])

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.qty, 0)
  const FREE_MIN = 80
  const discountNum = Math.max(0, parseFloat(form.discount) || 0)
  const total = Math.max(0, subtotal + (deliveryFee ?? 0) - discountNum)

  const fetchFee = useCallback(async (postcode: string) => {
    if (!/^\d{5}$/.test(postcode)) { setDeliveryFee(null); return }
    setFetchingFee(true)
    try {
      const r = await fetch(`/api/lp/quick/order?postcode=${postcode}&subtotal=${subtotal}&qty=${items.reduce((s, i) => s + i.qty, 0)}`)
      if (r.ok) { const d = await r.json(); setDeliveryFee(d.fee ?? 15) }
      else setDeliveryFee(15)
    } catch { setDeliveryFee(15) }
    finally { setFetchingFee(false) }
  }, [subtotal, items])

  useEffect(() => { if (form.postcode) fetchFee(form.postcode) }, [form.postcode, fetchFee])

  const filtered = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : products

  function addProduct(product: Product, variant: Variant | null) {
    const key = variant ? variant.id : product.id
    const existing = items.find(i => (variant ? i.variant_id === key : i.product_id === key && !i.variant_id))
    if (existing) {
      setItems(prev => prev.map(i => (variant ? i.variant_id === key : i.product_id === key && !i.variant_id) ? { ...i, qty: i.qty + 1 } : i))
    } else {
      setItems(prev => [...prev, {
        product_id: product.id,
        variant_id: variant?.id ?? null,
        product_name: product.name,
        variant_name: variant?.name ?? null,
        qty: 1,
        unit_price: variant ? variant.price : product.price,
      }])
    }
    setShowPicker(false)
    setSearch('')
  }

  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function setQty(idx: number, qty: number) {
    if (qty < 1) { removeItem(idx); return }
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, qty } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { toast.error('Add at least 1 product'); return }
    if (!/^\d{5}$/.test(form.postcode.trim())) { toast.error('Poskod diperlukan (5 digit)'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { toast.error('Email yang sah diperlukan'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/quick-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discount: discountNum,
          items: items.map(i => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.qty })),
          source: form.staff_name.trim() ? `whatsapp-${form.staff_name.trim()}` : 'whatsapp',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setSuccess({ order_number: data.order_number, total: data.total })
      toast.success(`Order ${data.order_number} created! WA sent to customer.`)
    } finally { setSubmitting(false) }
  }

  function reset() {
    setItems([]); setForm(f => ({ name: '', phone: '', email: '', address: '', postcode: '', notes: '', payment_method: 'bank_transfer', staff_name: f.staff_name, discount: '' }))
    setSuccess(null); setDeliveryFee(null)
  }

  if (success) return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-green-600 p-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-white" />
          </div>
          <p className="text-2xl font-black text-white">Order Created!</p>
          <p className="text-green-100 mt-1">WA confirmation sent to customer</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Order No.</span><span className="font-black font-mono">{success.order_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-black text-green-600">RM{Number(success.total).toFixed(2)}</span></div>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800">
              + New Order
            </button>
            <a href="/admin/orders" className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold text-sm text-center hover:bg-gray-50">
              View Orders
            </a>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" /> Quick Order
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Create order for WhatsApp customers</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">Customer Details</p>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-400">Staff:</label>
              <input value={form.staff_name} onChange={e => setForm(f => ({ ...f, staff_name: e.target.value }))}
                placeholder="Your name" className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300 w-28" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">NAME *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                placeholder="Customer name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">PHONE *</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required
                placeholder="01XXXXXXXX" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">EMAIL <span className="text-red-500">*</span> <span className="text-gray-300 font-normal">(notifikasi customer guna email)</span></label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
              placeholder="email@contoh.com" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">ADDRESS *</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required rows={2}
              placeholder="Full delivery address" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">POSTCODE</label>
              <input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value.replace(/\D/g, '') }))} maxLength={5} required
                placeholder="47810" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">NOTES</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Special instructions" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">PAYMENT METHOD</label>
            <div className="grid grid-cols-2 gap-2">
              {payOptions.map(opt => (
                <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, payment_method: opt.value }))}
                  className={`p-2.5 rounded-xl border-2 text-left text-xs font-bold transition-all ${form.payment_method === opt.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-700">Products</p>
            <button type="button" onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800">
              <Plus className="h-3.5 w-3.5" /> Add Product
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
              No products added yet
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                    {item.variant_name && <p className="text-xs text-gray-400">{item.variant_name}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setQty(idx, item.qty - 1)} className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-sm font-bold flex items-center justify-center hover:bg-gray-100">−</button>
                    <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                    <button type="button" onClick={() => setQty(idx, item.qty + 1)} className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-sm font-bold flex items-center justify-center hover:bg-gray-100">+</button>
                  </div>
                  <span className="text-sm font-bold text-gray-900 w-20 text-right">RM{(item.unit_price * item.qty).toFixed(2)}</span>
                  <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {items.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>RM{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Delivery</span>
                <span>{fetchingFee ? '...' : deliveryFee === null ? (subtotal >= FREE_MIN ? <span className="text-green-600 font-bold">FREE</span> : '—') : deliveryFee === 0 ? <span className="text-green-600 font-bold">FREE</span> : `RM${deliveryFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500">
                <span>Diskaun (RM)</span>
                <input
                  type="number" min="0" step="0.01"
                  value={form.discount}
                  onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
                  placeholder="0.00"
                  className="w-24 border border-gray-200 rounded-lg px-2.5 py-1 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
              <div className="flex justify-between font-black text-base border-t border-gray-100 pt-1.5">
                <span>TOTAL</span><span>RM{total.toFixed(2)}{deliveryFee === null && subtotal < FREE_MIN ? '+' : ''}</span>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={submitting || items.length === 0 || !/^\d{5}$/.test(form.postcode.trim()) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())}
          className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-base hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg">
          {submitting ? <><RefreshCw className="h-5 w-5 animate-spin" /> Creating...</> : <><MessageCircle className="h-5 w-5" /> Create Order + Send WA</>}
        </button>
      </form>

      {/* Product Picker */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowPicker(false); setSearch('') }} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 shrink-0">
              <p className="font-bold text-gray-900 mb-3">Select Product</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search product..." className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-2">
              {filtered.map(product => {
                const activeVariants = product.product_variants?.filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order) ?? []
                return (
                  <div key={product.id} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-sm font-bold text-gray-900 mb-2">{product.name}</p>
                    {activeVariants.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeVariants.map(v => (
                          <button key={v.id} type="button" onClick={() => addProduct(product, v)}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold hover:border-gray-900 hover:bg-gray-50 transition-colors">
                            {v.name} · RM{Number(v.price).toFixed(0)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button type="button" onClick={() => addProduct(product, null)}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold hover:border-gray-900 transition-colors">
                        RM{Number(product.price).toFixed(2)} — Add
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
