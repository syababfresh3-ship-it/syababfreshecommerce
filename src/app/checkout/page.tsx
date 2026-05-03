'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/stores/cart'
import { StoreLayout } from '@/components/layout/store-layout'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { trackInitiateCheckout } from '@/lib/tracking'
import Link from 'next/link'
import {
  Loader2, MapPin, Clock, CheckCircle2, Tag, Star,
  Building2, Smartphone, PackageCheck, ArrowLeftRight,
  Lock, ChevronRight, Pencil, Truck, XCircle,
} from 'lucide-react'
import type { Address } from '@/types'

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  fpx:          Building2,
  ewallet:      Smartphone,
  cod:          PackageCheck,
  bank_transfer:ArrowLeftRight,
}

interface SlotConfig {
  id: string; day: 'today' | 'tomorrow'; start: number; end: number
  label: string; lead_hours: number; active: boolean
}

function buildDeliverySlots(configs: SlotConfig[]) {
  const now = new Date()
  const hour = Number(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', hour12: false }))
  const slots: { value: string; label: string }[] = []

  for (const s of configs.filter(c => c.active)) {
    if (s.day === 'today') {
      if (hour + (s.lead_hours ?? 2) <= s.start) {
        slots.push({ value: `today-${s.start}`, label: `Hari ini, ${s.label}` })
      }
    } else {
      slots.push({ value: `tomorrow-${s.start}`, label: `Esok, ${s.label}` })
    }
  }
  return slots
}

const DEFAULT_SLOTS: SlotConfig[] = [
  { id: 'today-10',    day: 'today',    start: 10, end: 14, label: '10am – 2pm',  lead_hours: 2, active: true },
  { id: 'today-14',    day: 'today',    start: 14, end: 18, label: '2pm – 6pm',   lead_hours: 2, active: true },
  { id: 'today-18',    day: 'today',    start: 18, end: 21, label: '6pm – 9pm',   lead_hours: 2, active: true },
  { id: 'tomorrow-8',  day: 'tomorrow', start: 8,  end: 12, label: '8am – 12pm',  lead_hours: 0, active: true },
  { id: 'tomorrow-12', day: 'tomorrow', start: 12, end: 16, label: '12pm – 4pm',  lead_hours: 0, active: true },
  { id: 'tomorrow-16', day: 'tomorrow', start: 16, end: 20, label: '4pm – 8pm',   lead_hours: 0, active: true },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getTotal, clearCart } = useCartStore()
  const subtotal = getTotal()

  const [freeDeliveryMin, setFreeDeliveryMin] = useState(80)
  const [zoneBaseFee, setZoneBaseFee] = useState<number>(15)
  const [slotConfigs, setSlotConfigs] = useState<SlotConfig[]>(DEFAULT_SLOTS)
  const deliveryFee = subtotal >= freeDeliveryMin ? 0 : zoneBaseFee

  const slots = buildDeliverySlots(slotConfigs)
  const [loading, setLoading] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  // payment step UI: show collapsed address by default, expand only when editing
  const [editingAddress, setEditingAddress] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string; code: string; type: 'percentage' | 'fixed'; value: number
  } | null>(null)
  const [userPoints, setUserPoints] = useState(0)
  const [userMultiplier, setUserMultiplier] = useState(1)
  const [usePoints, setUsePoints] = useState(false)
  const [postcodeValid, setPostcodeValid] = useState<boolean | null>(null)
  const [postcodeArea, setPostcodeArea] = useState('')
  const [manualPostcode, setManualPostcode] = useState('')
  const [localOnlyItems, setLocalOnlyItems] = useState<string[]>([])
  const [paymentOptions, setPaymentOptions] = useState<{ value: string; label: string; sublabel: string; icon: React.ElementType }[]>([])
  const [form, setForm] = useState({
    full_address: '',
    delivery_slot: slots[0]?.value ?? '',
    notes: '',
    payment_method: '',
  })

  useEffect(() => {
    if (items.length > 0) trackInitiateCheckout(getTotal())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Fetch delivery settings from server
    fetch('/api/settings/delivery')
      .then(r => r.json())
      .then(d => {
        if (d.free_delivery_min != null) setFreeDeliveryMin(d.free_delivery_min)
        if (d.default_delivery_fee != null) setZoneBaseFee(d.default_delivery_fee)
        if (Array.isArray(d.slots) && d.slots.length > 0) setSlotConfigs(d.slots)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Load active payment methods
    supabase
      .from('payment_methods')
      .select('id, label, sublabel')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const opts = (data ?? []).map(m => ({
          value: m.id,
          label: m.label,
          sublabel: m.sublabel ?? '',
          icon: PAYMENT_ICONS[m.id] ?? Building2,
        }))
        setPaymentOptions(opts)
        if (opts.length > 0) {
          setForm(prev => ({ ...prev, payment_method: prev.payment_method || opts[0].value }))
        }
      })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      Promise.all([
        supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
        supabase.from('profiles').select('total_points, loyalty_tiers(multiplier)').eq('id', user.id).single(),
      ]).then(([addressRes, profileRes]) => {
        const data = addressRes.data
        if (data && data.length > 0) {
          setSavedAddresses(data as Address[])
          const def = data.find((a: Address) => a.is_default) ?? data[0]
          setSelectedAddressId(def.id)
          setForm((prev) => ({ ...prev, full_address: buildAddressString(def as Address) }))
        } else {
          // No saved addresses — open editor immediately
          setEditingAddress(true)
        }
        if (profileRes.data) {
          setUserPoints(profileRes.data.total_points ?? 0)
          setUserMultiplier((profileRes.data.loyalty_tiers as any)?.multiplier ?? 1)
        }
      })
    })
  }, [])

  function buildAddressString(addr: Address) {
    const parts = [addr.full_address]
    if (addr.postcode || addr.city || addr.state) {
      parts.push([addr.postcode, addr.city, addr.state].filter(Boolean).join(', '))
    }
    return parts.join('\n')
  }

  async function checkPostcode(postcode: string) {
    if (!postcode || !/^\d{5}$/.test(postcode)) {
      setPostcodeValid(null)
      setPostcodeArea('')
      setZoneBaseFee(zoneBaseFee)
      setLocalOnlyItems([])
      return
    }
    const res = await fetch(`/api/delivery/check?postcode=${postcode}`)
    const data = await res.json()
    setPostcodeValid(data.covered)
    setPostcodeArea(data.covered ? `${data.area}, ${data.city}` : '')
    if (data.fee !== undefined) setZoneBaseFee(data.fee)

    // Luar Klang Valley — semak jika ada item local-only dalam cart
    if (!data.covered && items.length > 0) {
      const supabase = createClient()
      const productIds = [...new Set(items.map(i => i.product.id))]
      const { data: products } = await supabase
        .from('products')
        .select('id, name, is_shippable')
        .in('id', productIds)
      const blocked = (products ?? [])
        .filter(p => !p.is_shippable)
        .map(p => p.name)
      setLocalOnlyItems(blocked)
    } else {
      setLocalOnlyItems([])
    }
  }

  function handleSelectAddress(id: string) {
    setSelectedAddressId(id)
    setPostcodeValid(null)
    setPostcodeArea('')
    if (id === '__manual__') {
      setForm((prev) => ({ ...prev, full_address: '' }))
      setManualPostcode('')
      return
    }
    const addr = savedAddresses.find((a) => a.id === id)
    if (addr) {
      setForm((prev) => ({ ...prev, full_address: buildAddressString(addr) }))
      setEditingAddress(false)
      if (addr.postcode) checkPostcode(addr.postcode)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleApplyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    setPromoLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('promo_codes')
      .select('id, code, type, value, min_order, max_uses, uses_count, expires_at')
      .eq('code', code).eq('active', true).single()

    if (error || !data) { toast.error('Kod promosi tidak sah atau tidak aktif'); setPromoLoading(false); return }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { toast.error('Kod promosi sudah tamat tempoh'); setPromoLoading(false); return }
    if (data.max_uses !== null && data.uses_count >= data.max_uses) { toast.error('Kod promosi sudah mencapai had penggunaan'); setPromoLoading(false); return }
    if (subtotal < Number(data.min_order)) { toast.error(`Min. pesanan RM${Number(data.min_order).toFixed(2)} untuk kod ini`); setPromoLoading(false); return }

    // Per-user limit — check if this user already used this promo in a non-cancelled order
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (currentUser) {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('promo_code_id', data.id)
        .neq('status', 'cancelled')
      if (count && count > 0) { toast.error('Anda sudah menggunakan kod ini sebelum ini'); setPromoLoading(false); return }
    }

    setAppliedPromo({ id: data.id, code: data.code, type: data.type, value: Number(data.value) })
    toast.success(`Kod ${data.code} berjaya digunakan!`)
    setPromoLoading(false)
  }

  const POINTS_RATE = 10
  const pointsDiscount = usePoints ? Math.min(userPoints / POINTS_RATE, subtotal + deliveryFee) : 0
  const pointsUsed = usePoints ? Math.min(userPoints, Math.floor((subtotal + deliveryFee) * POINTS_RATE)) : 0

  function calcDiscount() {
    let discount = 0
    if (appliedPromo) {
      discount += appliedPromo.type === 'percentage'
        ? Math.min((subtotal * appliedPromo.value) / 100, subtotal)
        : Math.min(appliedPromo.value, subtotal)
    }
    discount += pointsDiscount
    return discount
  }

  const finalTotal = subtotal + deliveryFee - calcDiscount()
  const selectedAddr = savedAddresses.find((a) => a.id === selectedAddressId)
  const selectedSlot = slots.find((s) => s.value === form.delivery_slot)
  // Nationwide = luar KV tapi semua item boleh pos → delivery 1–3 hari lori sejuk
  const isNationwide = postcodeValid === false && localOnlyItems.length === 0 && items.length > 0

  if (items.length === 0) {
    return (
      <StoreLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <p className="text-gray-400 mb-4">Troli kosong</p>
          <Link href="/products" className="text-brand-fresh-600 font-semibold">Kembali beli-belah</Link>
        </div>
      </StoreLayout>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_address.trim()) { toast.error('Sila masukkan alamat penghantaran'); return }

    if (localOnlyItems.length > 0) {
      toast.error(`Item berikut hanya boleh dihantar dalam Klang Valley: ${localOnlyItems.join(', ')}`)
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sila log masuk dahulu'); router.push('/login?redirect=/checkout'); setLoading(false); return }

    // Create order + items via server API — prices recalculated from DB, promo validated server-side
    const postcode = selectedAddressId !== '__manual__'
      ? savedAddresses.find(a => a.id === selectedAddressId)?.postcode ?? manualPostcode
      : manualPostcode

    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(({ product, variant, quantity }) => ({
          product_id: product.id,
          variant_id: variant?.id ?? null,
          quantity,
        })),
        postcode: postcode || null,
        payment_method: form.payment_method,
        delivery_address: form.full_address,
        delivery_slot: slots.find(s => s.value === form.delivery_slot)?.label ?? null,
        notes: form.notes || null,
        promo_code: appliedPromo?.code ?? null,
        use_points: usePoints,
      }),
    })

    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}))
      toast.error(err.error ?? 'Gagal buat pesanan. Cuba lagi.')
      setLoading(false)
      return
    }

    const { orderId, pointsUsed: serverPointsUsed, multiplier: serverMultiplier, total: serverTotal, needsApproval } = await orderRes.json()
    const order = { id: orderId }
    const total = serverTotal

    // First-time COD customer — admin needs to approve before inventory deducted
    if (needsApproval) {
      fetch('/api/notify-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      }).catch(() => {})
      clearCart()
      router.push(`/orders/${order.id}?new=1&approval=1`)
      return
    }

    // For FPX/e-wallet — points and promo handled in webhook AFTER payment confirmed.
    // Do NOT deduct here — if payment fails, points would be lost with no recourse.
    if (form.payment_method === 'fpx' || form.payment_method === 'ewallet') {
      const chipRes = await fetch('/api/checkout/chip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })

      if (!chipRes.ok) {
        toast.error('Gagal sambung ke payment gateway. Cuba lagi.')
        setLoading(false)
        return
      }

      const { checkoutUrl } = await chipRes.json()
      clearCart()
      window.location.href = checkoutUrl
      return
    }

    // COD / bank_transfer — deduct inventory immediately
    const deductResults = await Promise.all(items.map(({ product, variant, quantity }) =>
      variant
        ? supabase.rpc('deduct_variant_stock', { p_variant_id: variant.id, p_quantity: quantity })
        : supabase.rpc('deduct_inventory', { p_product_id: product.id, p_quantity: quantity })
    ))
    const oversoldIndex = deductResults.findIndex((r) => r.error)
    if (oversoldIndex !== -1) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
      const failedItem = items[oversoldIndex]
      toast.error(`Stok tidak mencukupi untuk ${failedItem.product.name}${failedItem.variant ? ` (${failedItem.variant.name})` : ''}. Sila semak troli anda.`)
      setLoading(false)
      return
    }

    if (serverPointsUsed > 0) {
      await supabase.from('loyalty_transactions').insert({
        user_id: user.id, order_id: order.id, points: -serverPointsUsed, type: 'redeem',
        description: `Redeem ${serverPointsUsed} mata untuk pesanan`,
      })
      await supabase.rpc('increment_points', { uid: user.id, pts: -serverPointsUsed })
    }

    const MAX_POINTS_PER_ORDER = 5000
    const earnedPoints = Math.min(Math.floor(total * serverMultiplier), MAX_POINTS_PER_ORDER)
    await supabase.from('loyalty_transactions').insert({
      user_id: user.id, order_id: order.id, points: earnedPoints, type: 'earn',
      description: `Pembelian`,
    })
    await Promise.all([
      supabase.rpc('increment_points', { uid: user.id, pts: earnedPoints }),
      supabase.rpc('increment_spend', { uid: user.id, amount: total }),
    ])
    if (appliedPromo) await supabase.rpc('increment_promo_uses', { promo_id: appliedPromo.id })

    fetch('/api/notify-order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    }).catch(() => {})

    clearCart()
    router.push(`/orders/${order.id}?new=1`)
  }

  // payment step UI: consistent section card
  const card = 'bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] overflow-hidden'

  return (
    <StoreLayout>
      <form id="checkout-form" onSubmit={handleSubmit} className="bg-gray-50 min-h-screen px-4 pt-4 pb-44 space-y-3">

        <h1 className="text-lg font-bold text-gray-900 px-0.5">Checkout</h1>

        {/* ── 1. DELIVERY ADDRESS ──────────────────────────── */}
        {/* payment step UI: show clean selected address card by default, expand to edit */}
        <div className={card}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-fresh-100 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-brand-fresh-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900">Alamat Penghantaran</h2>
            </div>
            {savedAddresses.length > 0 && (
              <button
                type="button"
                onClick={() => setEditingAddress(!editingAddress)}
                className="flex items-center gap-1 text-xs font-semibold text-brand-fresh-600 active:opacity-70"
              >
                <Pencil className="h-3 w-3" />
                {editingAddress ? 'Selesai' : 'Tukar'}
              </button>
            )}
          </div>

          <div className="px-4 pb-4">
            {/* final polish: confirmed address feels like a destination, not a form field */}
            {!editingAddress && selectedAddr && (
              <div className="bg-brand-fresh-50 border border-brand-fresh-200 rounded-xl px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-extrabold text-brand-fresh-700 uppercase tracking-widest">
                        {selectedAddr.label}
                      </span>
                      {selectedAddr.recipient_name && (
                        <span className="text-[11px] text-gray-400">· {selectedAddr.recipient_name}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 leading-snug">{selectedAddr.full_address}</p>
                    {(selectedAddr.postcode || selectedAddr.city) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[selectedAddr.postcode, selectedAddr.city, selectedAddr.state].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                  {/* final polish: checkmark chip reinforces "this is confirmed" */}
                  <span className="shrink-0 flex items-center gap-1 bg-brand-fresh-100 text-brand-fresh-700 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5">
                    <CheckCircle2 className="h-3 w-3" /> Disahkan
                  </span>
                </div>
              </div>
            )}

            {/* Expanded: address picker */}
            {(editingAddress || savedAddresses.length === 0) && (
              <div className="space-y-2">
                {savedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => handleSelectAddress(addr.id)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl border-2 transition-all active:scale-[0.99] ${
                      selectedAddressId === addr.id
                        ? 'border-brand-fresh-400 bg-brand-fresh-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wide">
                          {addr.label}
                        </span>
                        {addr.recipient_name && (
                          <span className="text-[11px] text-gray-400">· {addr.recipient_name}</span>
                        )}
                      </div>
                      {selectedAddressId === addr.id && (
                        <CheckCircle2 className="h-4 w-4 text-brand-fresh-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-1">{addr.full_address}</p>
                    {(addr.postcode || addr.city) && (
                      <p className="text-xs text-gray-400">{[addr.postcode, addr.city].filter(Boolean).join(' ')}</p>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleSelectAddress('__manual__')}
                  className={`w-full text-left px-3.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    selectedAddressId === '__manual__'
                      ? 'border-brand-fresh-400 bg-brand-fresh-50 text-brand-fresh-700'
                      : 'border-dashed border-gray-200 text-gray-400'
                  }`}
                >
                  + Taip alamat lain
                </button>
              </div>
            )}

            {/* Manual address textarea + postcode check */}
            {(savedAddresses.length === 0 || selectedAddressId === '__manual__') && (
              <div className="mt-2 space-y-2">
                <textarea
                  name="full_address"
                  value={form.full_address}
                  onChange={handleChange}
                  required
                  rows={3}
                  placeholder="No. rumah, jalan, kawasan, bandar..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
                />
                <div className="flex gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={5}
                    value={manualPostcode}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '')
                      setManualPostcode(v)
                      setPostcodeValid(null)
                      if (v.length === 5) checkPostcode(v)
                    }}
                    placeholder="Poskod (5 digit)"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
                  />
                </div>
                {postcodeValid === true && (
                  <p className="text-xs text-brand-fresh-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {postcodeArea} — Kami hantar ke sini!
                  </p>
                )}
                {postcodeValid === false && (
                  <div className="space-y-1.5">
                    {isNationwide ? (
                      <p className="text-xs text-brand-fresh-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Boleh dihantar ke seluruh Malaysia — anggaran 1–3 hari bekerja
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-red-500 font-semibold">
                          ⚠ Maaf, kawasan ini belum diliputi penghantaran kami
                        </p>
                        {localOnlyItems.length > 0 && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                            <p className="text-xs font-bold text-orange-700 mb-1">📍 Item berikut Klang Valley sahaja:</p>
                            {localOnlyItems.map(name => (
                              <p key={name} className="text-xs text-orange-600">• {name}</p>
                            ))}
                            <p className="text-[10px] text-orange-500 mt-1.5">Buang item ini atau gunakan alamat dalam Klang Valley.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Saved address postcode status */}
            {selectedAddressId && selectedAddressId !== '__manual__' && postcodeValid === false && (
              <div className="mt-2 space-y-1.5">
                {isNationwide ? (
                  <p className="text-xs text-brand-fresh-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Boleh dihantar ke seluruh Malaysia — anggaran 1–3 hari bekerja
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-red-500 font-semibold">
                      ⚠ Maaf, poskod {savedAddresses.find(a => a.id === selectedAddressId)?.postcode} belum diliputi penghantaran kami
                    </p>
                    {localOnlyItems.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                        <p className="text-xs font-bold text-orange-700 mb-1">📍 Item berikut Klang Valley sahaja:</p>
                        {localOnlyItems.map(name => (
                          <p key={name} className="text-xs text-orange-600">• {name}</p>
                        ))}
                        <p className="text-[10px] text-orange-500 mt-1.5">Buang item ini atau gunakan alamat dalam Klang Valley.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            {selectedAddressId && selectedAddressId !== '__manual__' && postcodeValid === true && (
              <p className="mt-2 text-xs text-brand-fresh-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {postcodeArea} — Kami hantar ke sini!
              </p>
            )}
          </div>
        </div>

        {/* ── 2. DELIVERY TIME ─────────────────────────────── */}
        <div className={card}>
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Masa Penghantaran</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {isNationwide ? 'Dihantar dengan lori sejuk beku' : 'Anggaran 2–4 jam selepas pesanan disahkan'}
              </p>
            </div>
          </div>

          {isNationwide ? (
            <div className="px-4 pb-4">
              <div className="bg-brand-fresh-50 border border-brand-fresh-200 rounded-xl px-4 py-3.5 flex items-start gap-3">
                <Truck className="h-4 w-4 text-brand-fresh-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-brand-fresh-700">1–3 Hari Bekerja</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Penghantaran lori sejuk beku ke seluruh Malaysia. Anda akan dihubungi untuk pengesahan tarikh.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 pb-4 grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, delivery_slot: slot.value }))}
                  className={`px-3 py-3 rounded-xl text-xs font-semibold border-2 transition-all active:scale-[0.97] text-left ${
                    form.delivery_slot === slot.value
                      ? 'bg-brand-fresh-500 text-white border-brand-fresh-500 shadow-[0_2px_8px_rgba(34,197,94,0.3)]'
                      : 'bg-white text-gray-600 border-gray-100'
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}

          {/* delivery fee nudge */}
          <div className="mx-4 mb-4 flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">Kos penghantaran</span>
            </div>
            <span className={`text-xs font-bold ${deliveryFee === 0 ? 'text-brand-fresh-600' : 'text-gray-900'}`}>
              {deliveryFee === 0 ? '✓ Percuma' : `RM${deliveryFee.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* ── 3. PAYMENT METHOD ────────────────────────────── */}
        {/* payment step UI: large icon cards — each method is a distinct tappable block */}
        <div className={card}>
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Kaedah Bayaran</h2>
              {/* final polish: "selamat" reassures user before they see payment options */}
              <p className="text-[11px] text-gray-400 mt-0.5">Selamat & disulitkan · Pilih yang sesuai</p>
            </div>
          </div>

          <div className="px-4 pb-3 space-y-2.5">
            {paymentOptions.map((opt) => {
              const selected = form.payment_method === opt.value
              return (
                // payment step UI: full card tap target, icon changes on select
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, payment_method: opt.value }))}
                  className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] will-change-transform text-left ${
                    selected
                      ? 'border-brand-fresh-400 bg-brand-fresh-50 shadow-[0_2px_10px_rgba(34,197,94,0.12)]'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  {/* payment step UI: icon pill changes color when selected */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'bg-brand-fresh-500' : 'bg-gray-100'
                  }`}>
                    <opt.icon className={`h-5 w-5 transition-colors ${selected ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold leading-snug ${selected ? 'text-gray-900' : 'text-gray-700'}`}>
                        {opt.label}
                      </p>
                      {/* final polish: social proof badge on most-used method */}
                      {opt.value === 'fpx' && (
                        <span className="text-[9px] font-extrabold bg-brand-yellow-100 text-brand-yellow-700 px-1.5 py-0.5 rounded-full leading-none">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{opt.sublabel}</p>
                  </div>
                  {/* payment step UI: checkmark confirms selection */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    selected ? 'border-brand-fresh-500 bg-brand-fresh-500' : 'border-gray-200'
                  }`}>
                    {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white fill-white" />}
                  </div>
                </button>
              )
            })}
          </div>
          {/* final polish: trust footer under payment methods — reduces hesitation at critical moment */}
          <p className="px-4 pb-4 text-[11px] text-gray-400 flex items-center gap-1.5">
            <Lock className="h-3 w-3 shrink-0" />
            Maklumat pembayaran anda selamat & tidak disimpan oleh kami
          </p>
        </div>

        {/* ── 4. SAVINGS: PROMO + LOYALTY ──────────────────── */}
        {/* payment step UI: grouped into one "jimat" section to reduce visual noise */}
        <div className={card}>
          <div className="px-4 pt-4 pb-2">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Jimat Lebih</h2>

            {/* final polish: "Ada kod?" framing feels like an offer, not a chore */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" /> Ada kod promosi?
              </p>
              {appliedPromo ? (
                <div className="flex items-center justify-between bg-brand-fresh-50 border border-brand-fresh-200 rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-brand-fresh-500 shrink-0" />
                    <span className="text-sm font-mono font-bold text-brand-fresh-700">{appliedPromo.code}</span>
                    <span className="text-xs text-brand-fresh-600">
                      {appliedPromo.type === 'percentage' ? `${appliedPromo.value}% off` : `RM${appliedPromo.value.toFixed(2)} off`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAppliedPromo(null); setPromoInput('') }}
                    className="text-xs text-gray-400 hover:text-red-400 font-medium"
                  >
                    Buang
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Contoh: FRESH10, JIMAT5..."
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyPromo())}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={promoLoading || !promoInput.trim()}
                      className="px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                    >
                      {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guna'}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Semak kod di Instagram atau channel WhatsApp kami 🎁
                  </p>
                </>
              )}
            </div>

            {/* Loyalty points */}
            {userPoints >= 100 && (
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-brand-yellow-500" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">
                        Mata Loyalty
                        {usePoints && <span className="text-brand-fresh-600"> — jimat RM{pointsDiscount.toFixed(2)}</span>}
                      </p>
                      <p className="text-[10px] text-gray-400">{userPoints.toLocaleString()} mata tersedia</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-brand-fresh-500 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                </div>
              </div>
            )}
          </div>
          <div className="h-4" />
        </div>

        {/* ── 5. ORDER SUMMARY ─────────────────────────────── */}
        {/* payment step UI: final cost breakdown before payment — total is dominant */}
        <div className={card}>
          <div className="px-4 pt-4 pb-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Ringkasan Pesanan</h2>

            <div className="space-y-2">
              {items.map(({ product, variant, quantity }) => (
                <div key={`${product.id}-${variant?.id ?? ''}`} className="flex justify-between items-start gap-2">
                  <span className="text-sm text-gray-500 line-clamp-1 flex-1">
                    {product.name}
                    {variant && <span className="text-gray-400"> ({variant.name})</span>}
                    <span className="text-gray-400"> × {quantity}</span>
                  </span>
                  <span className="text-sm font-semibold text-gray-900 shrink-0 tabular-nums">
                    RM{(Number(variant?.price ?? product.price) * quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 mt-3 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-gray-700 tabular-nums">RM{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Kos penghantaran</span>
                <span className={`tabular-nums ${deliveryFee === 0 ? 'text-brand-fresh-600 font-semibold' : 'text-gray-700'}`}>
                  {deliveryFee === 0 ? '✓ Percuma' : `RM${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              {subtotal < freeDeliveryMin && (
                <p className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1.5">
                  Tambah RM{(freeDeliveryMin - subtotal).toFixed(2)} untuk penghantaran percuma
                </p>
              )}
              {appliedPromo && (
                <div className="flex justify-between text-sm text-brand-fresh-600">
                  <span>Diskaun ({appliedPromo.code})</span>
                  <span className="tabular-nums">
                    -RM{(appliedPromo.type === 'percentage'
                      ? Math.min((subtotal * appliedPromo.value) / 100, subtotal)
                      : Math.min(appliedPromo.value, subtotal)).toFixed(2)}
                  </span>
                </div>
              )}
              {usePoints && pointsDiscount > 0 && (
                <div className="flex justify-between text-sm text-brand-fresh-600">
                  <span>Mata ({pointsUsed.toLocaleString()} pts)</span>
                  <span className="tabular-nums">-RM{pointsDiscount.toFixed(2)}</span>
                </div>
              )}

              {/* payment step UI: TOTAL row — largest, most dominant element on the page */}
              <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-600">Jumlah Bayaran</span>
                <span className="text-2xl font-black text-gray-900 tabular-nums">
                  RM{finalTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. NOTES (minimal) ───────────────────────────── */}
        <div className={card}>
          <div className="px-4 pt-4 pb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Nota untuk rider (pilihan)</h2>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Cth: Tinggal di pintu, hubungi jika tiada orang..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
            />
          </div>
        </div>
      </form>

      {/* ── STICKY CTA BAR ───────────────────────────────── */}
      {/* payment step UI: the most important element — total + pay button, lock icon = safe */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 px-4 pt-3.5 pb-[calc(env(safe-area-inset-bottom)+4.25rem)]">

        {/* Summary row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-gray-400 leading-none mb-1 uppercase tracking-wider">Jumlah bayaran</p>
            <p className="text-2xl font-black text-gray-900 leading-none tabular-nums">
              RM{finalTotal.toFixed(2)}
            </p>
          </div>
          {/* Selected slot preview */}
          {selectedSlot && (
            <div className="text-right">
              <p className="text-[10px] text-gray-400">Slot dipilih</p>
              <p className="text-xs font-semibold text-gray-600 mt-0.5">{selectedSlot.label}</p>
            </div>
          )}
        </div>

        {/* payment step UI: "Bayar Sekarang" — clear, final, safe */}
        <button
          form="checkout-form"
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 bg-brand-fresh-500 text-white font-bold py-4 rounded-2xl text-base shadow-[0_4px_18px_rgba(34,197,94,0.38)] disabled:opacity-60 active:scale-[0.98] transition-all will-change-transform"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Memproses pesanan...
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 opacity-80" />
              Bayar Sekarang
              <ChevronRight className="h-4 w-4 opacity-70" />
            </>
          )}
        </button>
      </div>
    </StoreLayout>
  )
}
