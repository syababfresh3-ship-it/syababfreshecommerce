'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLpCart } from '@/lib/stores/lp-cart'
import { toast } from 'sonner'
import { ShoppingBag, X, Minus, Plus, User, Phone, MapPin, Hash, ChevronRight, CheckCircle, MessageCircle, Trash2 } from 'lucide-react'
import { freeDeliveryActive } from '@/lib/shipping'
import { lookupPromo, promoDiscount, type AppliedPromo } from '@/lib/lp-promo'
import { useLpLoyalty, pointsDiscountFor } from '@/lib/lp-loyalty-client'

interface Props { slug: string; freeMin?: number; pickupEnabled?: boolean }
type Step = 'form' | 'done'

interface PaymentMethod { id: string; label: string; sublabel: string }

export function LpCartBar({ slug, freeMin = 80, pickupEnabled = false }: Props) {
  const items = useLpCart(s => s.items)
  const removeItem = useLpCart(s => s.removeItem)
  const updateQty = useLpCart(s => s.updateQty)
  const subtotal = useLpCart(s => s.subtotal)
  const count = useLpCart(s => s.count)
  const clear = useLpCart(s => s.clear)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [mounted, setMounted] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [form, setForm] = useState({ name: '', phone: '', address: '', postcode: '', notes: '', payment_method: '' })
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null)
  const [fetchingFee, setFetchingFee] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [orderResult, setOrderResult] = useState<{ order_number: string; total: number } | null>(null)
  // Penghantaran vs ambil sendiri (pickup)
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery')
  const [pickupDate, setPickupDate] = useState('')
  const isPickup = pickupEnabled && deliveryMethod === 'pickup'
  const pickupMinDate = new Date().toISOString().split('T')[0]
  // Kod promosi
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  // Mata loyalty (login-pilihan)
  const loyalty = useLpLoyalty()
  const [usePoints, setUsePoints] = useState(false)

  useEffect(() => setMounted(true), [])

  const FREE_MIN = freeMin
  const freeOn = freeDeliveryActive(FREE_MIN)  // toggle "Penghantaran Percuma" aktif?
  const sub = subtotal()
  const discount = promoDiscount(appliedPromo, sub)
  const fee = isPickup ? 0 : (deliveryFee ?? 0)
  const redeemable = Math.max(0, sub + fee - discount)
  const ptsDiscount = pointsDiscountFor(loyalty.loggedIn && usePoints, loyalty.points, redeemable)
  const total = Math.max(0, sub + fee - discount - ptsDiscount)

  const fetchFee = useCallback(async (postcode: string) => {
    if (!/^\d{5}$/.test(postcode)) { setDeliveryFee(null); return }
    setFetchingFee(true)
    try {
      const res = await fetch(`/api/lp/${slug}/order?postcode=${postcode}&subtotal=${sub}`)
      const data = await res.json()
      setDeliveryFee(data.fee ?? 15)
    } catch { setDeliveryFee(15) }
    finally { setFetchingFee(false) }
  }, [slug, sub])

  useEffect(() => {
    if (open) fetchFee(form.postcode)
  }, [form.postcode, open, fetchFee])

  if (!mounted || count() === 0) return null

  async function openDrawer() {
    setStep('form')
    setOrderResult(null)
    setOpen(true)
    if (paymentMethods.length === 0) {
      const res = await fetch('/api/lp/payment-methods')
      const methods: PaymentMethod[] = await res.json()
      setPaymentMethods(methods)
      if (methods.length > 0 && !form.payment_method) {
        setForm(f => ({ ...f, payment_method: methods[0].id }))
      }
    }
  }

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code) return
    setPromoLoading(true)
    const { promo, error } = await lookupPromo(code, sub)
    setPromoLoading(false)
    if (error || !promo) { toast.error(error ?? 'Kod tidak sah'); setAppliedPromo(null); return }
    setAppliedPromo(promo)
    toast.success(`Kod ${promo.code} digunakan!`)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Sila masukkan nama'); return }
    if (!form.phone.trim()) { toast.error('Sila masukkan no. telefon'); return }
    if (isPickup) {
      if (!pickupDate) { toast.error('Sila pilih tarikh untuk ambil sendiri'); return }
    } else if (!form.address.trim() || form.address.trim().length < 10) {
      toast.error('Sila masukkan alamat lengkap'); return
    }
    if (!form.payment_method) { toast.error('Sila pilih kaedah bayaran'); return }

    const params = new URLSearchParams(window.location.search)
    const source = [params.get('utm_source'), params.get('utm_campaign')].filter(Boolean).join('/') || null

    setSubmitting(true)
    try {
      const res = await fetch(`/api/lp/${slug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: isPickup ? '' : form.address.trim(),
          postcode: isPickup ? null : (form.postcode.trim() || null),
          notes: form.notes.trim() || null,
          payment_method: form.payment_method,
          delivery_method: deliveryMethod,
          pickup_date: isPickup ? pickupDate : null,
          promo_code: appliedPromo?.code ?? null,
          use_points: loyalty.loggedIn && usePoints,
          source,
          items: items.map(i => ({
            product_id: i.productId,
            variant_id: i.variantId,
            product_name: i.productName,
            variant_name: i.variantName,
            quantity: i.qty,
            unit_price: i.unitPrice,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Gagal buat pesanan'); return }
      setOrderResult(data)
      setStep('done')
      clear()
    } finally { setSubmitting(false) }
  }

  function waConfirm() {
    if (!orderResult) return
    const itemLines = items.map(i =>
      `• ${i.productName}${i.variantName ? ` (${i.variantName})` : ''} × ${i.qty} — RM${(i.unitPrice * i.qty).toFixed(2)}`
    ).join('\n')
    const msg = encodeURIComponent(
      `Assalamualaikum! Saya ingin sahkan pesanan:\n\n` +
      `${itemLines}\n\n` +
      `🔢 No. Pesanan: *${orderResult.order_number}*\n` +
      `💰 Jumlah: *RM${orderResult.total.toFixed(2)}*\n` +
      (isPickup ? `🏪 Ambil Sendiri di kedai${pickupDate ? ` (${pickupDate})` : ''}` : `🏠 Alamat: ${form.address}`) +
      `\n\nTerima kasih!`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener')
  }

  return (
    <>
      {/* Floating cart bar */}
      <div className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto">
        <button
          onClick={openDrawer}
          className="w-full flex items-center justify-between bg-green-500 text-white px-5 py-4 rounded-2xl shadow-[0_8px_32px_rgba(34,197,94,0.5)] active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-white text-green-600 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {count()}
              </span>
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold opacity-90">{count()} item dipilih</p>
              <p className="text-base font-black">RM{sub.toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-xl px-3 py-1.5">
            <span className="text-sm font-bold">Bayar Sekarang</span>
            <ChevronRight className="h-4 w-4" />
          </div>
        </button>
      </div>

      {/* Checkout drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && setOpen(false)} />
          <div className="relative mt-auto bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {step === 'form' ? (
              <>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                  <p className="font-bold text-gray-900">Pesanan Anda ({count()} item)</p>
                  <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

                  {/* Item list */}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    {items.map(item => (
                      <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                          {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                        </div>
                        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 px-1">
                          <button type="button" onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)} className="w-6 h-6 flex items-center justify-center">
                            <Minus className="h-3 w-3 text-gray-500" strokeWidth={2.5} />
                          </button>
                          <span className="w-5 text-center text-xs font-black">{item.qty}</span>
                          <button type="button" onClick={() => updateQty(item.productId, item.variantId, item.qty + 1)} className="w-6 h-6 flex items-center justify-center">
                            <Plus className="h-3 w-3 text-gray-500" strokeWidth={2.5} />
                          </button>
                        </div>
                        <span className="text-sm font-black text-green-600 w-14 text-right shrink-0">
                          RM{(item.unitPrice * item.qty).toFixed(2)}
                        </span>
                        <button type="button" onClick={() => removeItem(item.productId, item.variantId)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Customer info */}
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama penuh" required className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="No. telefon (cth: 0123456789)" required className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                  </div>

                  {/* Penghantaran vs Ambil Sendiri */}
                  {pickupEnabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setDeliveryMethod('delivery')}
                        className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${!isPickup ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>🚚 Penghantaran</button>
                      <button type="button" onClick={() => setDeliveryMethod('pickup')}
                        className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${isPickup ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>🏪 Ambil Sendiri</button>
                    </div>
                  )}

                  {isPickup ? (
                    <>
                      <div className="bg-green-50 rounded-xl p-3 text-xs text-gray-600 leading-relaxed">
                        <p className="font-bold text-green-700 mb-0.5">🏪 Ambil di kedai — SyababFresh, Bangi</p>
                        Kompleks Premis Usahawan SME Bank Bangi, Seksyen 16, 43650 Bandar New Bangi · Isnin–Sabtu, 9 pagi–6 petang
                      </div>
                      <input type="date" value={pickupDate} min={pickupMinDate} onChange={e => setPickupDate(e.target.value)} required className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                        <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Alamat penghantaran lengkap" required rows={3} className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
                      </div>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input type="text" inputMode="numeric" maxLength={5} value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value.replace(/\D/g, '') }))} placeholder="Poskod (cth: 47810)" className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      </div>
                    </>
                  )}
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Nota tambahan (pilihan)" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />

                  {/* Payment */}
                  {paymentMethods.length > 0 && (
                    <div className={`grid gap-2 ${paymentMethods.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {paymentMethods.map(pm => (
                        <button key={pm.id} type="button" onClick={() => setForm(f => ({ ...f, payment_method: pm.id }))}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${form.payment_method === pm.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                          <p className="text-xs font-bold text-gray-900">{pm.label}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{pm.sublabel}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {paymentMethods.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Memuatkan kaedah bayaran...</p>
                  )}

                  {/* Kod promosi */}
                  {appliedPromo ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                      <span className="text-sm font-bold text-green-700">🎟️ {appliedPromo.code} — diskaun RM{discount.toFixed(2)}</span>
                      <button type="button" onClick={() => { setAppliedPromo(null); setPromoInput('') }} className="text-xs font-bold text-red-600">Buang</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="Kod promosi (pilihan)" className="flex-1 px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                      <button type="button" onClick={applyPromo} disabled={promoLoading || !promoInput.trim()} className="px-5 bg-green-500 text-white rounded-xl font-bold text-sm disabled:opacity-40">{promoLoading ? '...' : 'Guna'}</button>
                    </div>
                  )}

                  {/* Mata Loyalty (login-pilihan) */}
                  {loyalty.loggedIn ? (loyalty.points > 0 && (
                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-sm font-bold text-amber-800">⭐ Mata Loyalty</p>
                        <p className="text-[11px] text-amber-600">{loyalty.points} mata · jimat hingga RM{(loyalty.points / 100).toFixed(2)}</p>
                      </div>
                      <button type="button" onClick={() => setUsePoints(v => !v)} className={`px-4 py-1.5 rounded-full text-xs font-bold ${usePoints ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{usePoints ? '✓ Guna' : 'Guna'}</button>
                    </div>
                  )) : (
                    <button type="button" onClick={() => { window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname) }} className="w-full text-center py-2.5 rounded-xl border border-dashed border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold">🔓 Log masuk untuk guna Mata Loyalty</button>
                  )}

                  {/* Summary */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({count()} item)</span>
                      <span>RM{sub.toFixed(2)}</span>
                    </div>
                    {appliedPromo && (
                      <div className="flex justify-between text-green-600 font-medium">
                        <span>Diskaun ({appliedPromo.code})</span>
                        <span>−RM{discount.toFixed(2)}</span>
                      </div>
                    )}
                    {ptsDiscount > 0 && (
                      <div className="flex justify-between text-amber-600 font-medium">
                        <span>⭐ Mata Loyalty</span>
                        <span>−RM{ptsDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>{isPickup ? 'Ambil Sendiri' : 'Penghantaran'}</span>
                      <span>
                        {isPickup
                          ? <span className="text-green-600 font-bold">PERCUMA</span>
                          : fetchingFee ? '...' : deliveryFee === null
                          ? freeOn && sub >= FREE_MIN ? <span className="text-green-600 font-bold">PERCUMA</span> : 'Isi poskod'
                          : deliveryFee === 0 ? <span className="text-green-600 font-bold">PERCUMA</span> : `RM${deliveryFee.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between font-black text-gray-900 border-t border-gray-200 pt-1.5 text-base">
                      <span>Jumlah</span>
                      <span className="text-green-600">RM{total.toFixed(2)}{!isPickup && deliveryFee === null && sub < FREE_MIN ? '+' : ''}</span>
                    </div>
                    {!isPickup && freeOn && sub < FREE_MIN && <p className="text-[11px] text-gray-400">Tambah RM{(FREE_MIN - sub).toFixed(2)} lagi untuk penghantaran percuma</p>}
                  </div>

                  <button type="submit" disabled={submitting || items.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-green-500 text-white rounded-2xl font-black text-base hover:bg-green-600 disabled:opacity-50 active:scale-[0.98] transition-all shadow-[0_4px_20px_rgba(34,197,94,0.4)]">
                    {submitting ? 'Menghantar...' : <><ChevronRight className="h-5 w-5" />Sahkan Pesanan</>}
                  </button>
                  <div className="h-4" />
                </form>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-1">Pesanan Diterima!</h2>
                <p className="text-sm text-gray-500 mb-6">Team kami akan hubungi anda untuk pengesahan.</p>
                <div className="w-full bg-gray-50 rounded-2xl p-4 space-y-1.5 text-sm text-left mb-6">
                  <div className="flex justify-between">
                    <span className="text-gray-500">No. Pesanan</span>
                    <span className="font-black font-mono">{orderResult?.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kaedah Bayar</span>
                    <span className="font-semibold">{paymentMethods.find(pm => pm.id === form.payment_method)?.label ?? form.payment_method}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1.5 font-black">
                    <span>Jumlah</span>
                    <span className="text-green-600">RM{orderResult?.total.toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={waConfirm} className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#25D366] text-white rounded-2xl font-bold text-sm mb-3 active:scale-[0.97] shadow-lg">
                  <MessageCircle className="h-5 w-5" fill="white" strokeWidth={0} />
                  Hantar Pengesahan via WhatsApp
                </button>
                <button onClick={() => setOpen(false)} className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 font-semibold">
                  Tutup
                </button>
                <div className="h-4" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
