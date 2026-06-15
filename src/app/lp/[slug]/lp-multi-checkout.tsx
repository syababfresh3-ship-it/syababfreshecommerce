'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { CheckCircle, MessageCircle, ChevronRight, Lock, Truck, Tag, PackageX } from 'lucide-react'
import type { Product, ProductVariant } from '@/types'
import { freeDeliveryActive } from '@/lib/shipping'
import { lookupPromo, promoDiscount, type AppliedPromo } from '@/lib/lp-promo'
import { useLpLoyalty, pointsDiscountFor } from '@/lib/lp-loyalty-client'
import { type SlotConfig, buildDeliverySlots } from '@/lib/delivery-slots'

interface ProductWithVariants extends Product {
  product_variants?: ProductVariant[]
}

interface Props {
  products: ProductWithVariants[]
  stocks: Record<string, number | null>
  slug: string
  freeMin?: number
  pickupEnabled?: boolean
  slotConfigs?: SlotConfig[]
}

interface PaymentMethod { id: string; label: string; sublabel: string }

interface ProductSelection {
  product: ProductWithVariants
  selectedVariant: ProductVariant | null
  qty: number
}

export function LpMultiCheckout({ products, stocks, slug, freeMin = 80, pickupEnabled = false, slotConfigs = [] }: Props) {
  // Init: only first product qty=1, rest qty=0
  const initSelections = (): ProductSelection[] =>
    products.map((p, i) => {
      const active = (p.product_variants ?? []).filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order)
      return { product: p, selectedVariant: active[0] ?? null, qty: i === 0 ? 1 : 0 }
    })

  const [selections, setSelections] = useState<ProductSelection[]>(initSelections)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', postcode: '', notes: '' })
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null)
  const [fetchingFee, setFetchingFee] = useState(false)
  const [postcodeBlocked, setPostcodeBlocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ order_number: string; total: number; payment_method: string } | null>(null)
  // Penghantaran vs ambil sendiri (pickup)
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery')
  const [pickupDate, setPickupDate] = useState('')
  const isPickup = pickupEnabled && deliveryMethod === 'pickup'
  const pickupMinDate = new Date().toISOString().split('T')[0]
  // Slot masa penghantaran — dikira di klien (elak hydration mismatch sebab guna waktu semasa)
  const [slots, setSlots] = useState<{ value: string; label: string }[]>([])
  const [deliverySlot, setDeliverySlot] = useState('')
  useEffect(() => {
    const s = buildDeliverySlots(slotConfigs)
    setSlots(s)
    setDeliverySlot(prev => prev || (s[0]?.value ?? ''))
  }, [slotConfigs])
  // Kod promosi
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)
  // Mata loyalty (login-pilihan)
  const loyalty = useLpLoyalty()
  const [usePoints, setUsePoints] = useState(false)

  const activeSelections = selections.filter(s => s.qty > 0)
  const subtotal = activeSelections.reduce((sum, s) => {
    const price = s.selectedVariant ? Number(s.selectedVariant.price) : Number(s.product.price)
    return sum + price * s.qty
  }, 0)
  const FREE_MIN = freeMin
  const freeOn = freeDeliveryActive(FREE_MIN)  // toggle "Penghantaran Percuma" aktif?
  const discount = promoDiscount(appliedPromo, subtotal)
  const fee = isPickup ? 0 : (deliveryFee ?? 0)
  const redeemable = Math.max(0, subtotal + fee - discount)
  const ptsDiscount = pointsDiscountFor(loyalty.loggedIn && usePoints, loyalty.points, redeemable)
  const total = Math.max(0, subtotal + fee - discount - ptsDiscount)

  useEffect(() => {
    fetch('/api/lp/payment-methods').then(r => r.json()).then((ms: PaymentMethod[]) => {
      setPaymentMethods(ms)
      if (ms.length > 0) setPaymentMethod(ms[0].id)
    }).catch(() => {})
  }, [])

  const fetchFee = useCallback(async (postcode: string) => {
    if (!/^\d{5}$/.test(postcode)) { setDeliveryFee(null); setPostcodeBlocked(false); return }
    setFetchingFee(true)
    try {
      const totalQty = activeSelections.reduce((s, sel) => s + sel.qty, 0)
      const r = await fetch(`/api/lp/${slug}/order?postcode=${postcode}&subtotal=${subtotal}&qty=${totalQty}`)
      const d = await r.json()
      if (d.available === false) { setPostcodeBlocked(true); setDeliveryFee(null); return }
      setPostcodeBlocked(false)
      setDeliveryFee(d.fee ?? 15)
    } catch { setDeliveryFee(15); setPostcodeBlocked(false) }
    finally { setFetchingFee(false) }
  }, [slug, subtotal, activeSelections])

  useEffect(() => { fetchFee(form.postcode) }, [form.postcode, fetchFee])

  function updateSelection(idx: number, patch: Partial<ProductSelection>) {
    setSelections(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code) return
    setPromoLoading(true)
    const { promo, error } = await lookupPromo(code, subtotal)
    setPromoLoading(false)
    if (error || !promo) { toast.error(error ?? 'Kod tidak sah'); setAppliedPromo(null); return }
    setAppliedPromo(promo)
    toast.success(`Kod ${promo.code} digunakan!`)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (activeSelections.length === 0) { toast.error('Sila pilih sekurang-kurangnya 1 produk'); return }
    if (!form.name.trim()) { toast.error('Sila masukkan nama'); return }
    if (!form.phone.trim()) { toast.error('Sila masukkan no. telefon'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { toast.error('Sila masukkan email yang sah'); return }
    if (isPickup) {
      if (!pickupDate) { toast.error('Sila pilih tarikh untuk ambil sendiri'); return }
    } else if (!form.address.trim() || form.address.trim().length < 10) {
      toast.error('Sila masukkan alamat lengkap'); return
    } else if (!/^\d{5}$/.test(form.postcode.trim())) {
      toast.error('Sila masukkan poskod (5 digit)'); return
    }
    if (!paymentMethod) { toast.error('Sila pilih kaedah bayaran'); return }

    const params = new URLSearchParams(window.location.search)
    const source = [params.get('utm_source'), params.get('utm_campaign')].filter(Boolean).join('/') || null

    setSubmitting(true)
    try {
      const res = await fetch(`/api/lp/${slug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null,
          address: isPickup ? '' : form.address.trim(), postcode: isPickup ? null : (form.postcode.trim() || null),
          notes: form.notes.trim() || null, payment_method: paymentMethod, source,
          delivery_method: deliveryMethod, pickup_date: isPickup ? pickupDate : null,
          delivery_slot: isPickup ? null : (slots.find(s => s.value === deliverySlot)?.label ?? null),
          promo_code: appliedPromo?.code ?? null,
          use_points: loyalty.loggedIn && usePoints,
          items: activeSelections.map(s => ({
            product_id: s.product.id,
            variant_id: s.selectedVariant?.id ?? null,
            product_name: s.product.name,
            variant_name: s.selectedVariant?.name ?? null,
            quantity: s.qty,
            unit_price: s.selectedVariant ? Number(s.selectedVariant.price) : Number(s.product.price),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Gagal buat pesanan'); return }
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return }
      setResult({ order_number: data.order_number, total: data.total, payment_method: paymentMethod })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally { setSubmitting(false) }
  }

  function waConfirm() {
    if (!result) return
    const lines = activeSelections.map(s => {
      const price = s.selectedVariant ? Number(s.selectedVariant.price) : Number(s.product.price)
      const varLine = s.selectedVariant ? ` (${s.selectedVariant.name})` : ''
      return `• ${s.product.name}${varLine} × ${s.qty} — RM${(price * s.qty).toFixed(2)}`
    }).join('\n')
    const msg = encodeURIComponent(
      `Assalamualaikum! Saya ingin sahkan pesanan:\n\n${lines}\n\n` +
      `🔢 No. Pesanan: *${result.order_number}*\n💰 Jumlah: *RM${result.total.toFixed(2)}*\n` +
      (isPickup ? `🏪 Ambil Sendiri di kedai${pickupDate ? ` (${pickupDate})` : ''}` : `🏠 Alamat: ${form.address}`) +
      `\n\nTerima kasih!`
    )
    window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? ''}?text=${msg}`, '_blank', 'noopener')
  }

  const cv = (name: string, fallback: string) => `var(${name}, ${fallback})`
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14, boxSizing: 'border-box',
    border: `1.5px solid ${cv('--cherry-border', '#e5e7eb')}`, background: '#fff', outline: 'none', fontFamily: 'inherit', color: '#111',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, letterSpacing: '0.04em' }
  const stepBadge: React.CSSProperties = {
    width: 26, height: 26, borderRadius: '50%', background: cv('--cherry', '#9C0F30'),
    color: '#fff', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }
  const sectionHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }
  const stepTitle: React.CSSProperties = { fontWeight: 800, fontSize: 14, color: '#111' }

  /* ── SUCCESS ── */
  if (result) return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: cv('--cream', '#fff'), border: `2px solid ${cv('--cherry-border', '#fecaca')}` }}>
      <div style={{ background: cv('--cherry', '#9C0F30'), padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <CheckCircle style={{ width: 32, height: 32, color: '#fff' }} />
        </div>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#fff', marginBottom: 4 }}>Pesanan Diterima!</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Team kami akan hubungi anda untuk pengesahan bayaran</p>
      </div>
      <div style={{ padding: '20px 20px 24px' }}>
        <div style={{ background: cv('--cherry-light', '#fef2f2'), borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
            <span>No. Pesanan</span>
            <span style={{ fontWeight: 900, fontFamily: 'monospace', color: cv('--cherry', '#9C0F30') }}>{result.order_number}</span>
          </div>
          {activeSelections.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: '#374151' }}>
              <span>{s.product.name}{s.selectedVariant ? ` · ${s.selectedVariant.name}` : ''} × {s.qty}</span>
              <span style={{ fontWeight: 700 }}>RM{((s.selectedVariant ? Number(s.selectedVariant.price) : Number(s.product.price)) * s.qty).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1.5px solid ${cv('--cherry-border', '#fecaca')}`, paddingTop: 10, fontWeight: 900, fontSize: 16 }}>
            <span>Jumlah Bayaran</span>
            <span style={{ color: cv('--cherry', '#9C0F30') }}>RM{result.total.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={waConfirm} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, background: '#25D366', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          <MessageCircle style={{ width: 20, height: 20 }} fill="white" strokeWidth={0} />
          Sahkan Pesanan via WhatsApp
        </button>
      </div>
    </div>
  )

  // Poskod tak sah (untuk penghantaran) ATAU kawasan disekat, atau email tak sah → halang submit
  const emailBad = !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
  const postcodeBad = postcodeBlocked || (!isPickup && !/^\d{5}$/.test(form.postcode.trim())) || emailBad

  /* ── MAIN FORM ── */
  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: cv('--cream', '#fff'), boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}>

      {/* Header */}
      <div style={{ background: cv('--cherry', '#9C0F30'), padding: '16px 20px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Borang Pesanan</p>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 17, color: '#fff' }}>
          {products.length} Produk tersedia
        </p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── STEP 1: Products ── */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={sectionHead}>
            <div style={stepBadge}>1</div>
            <div>
              <p style={stepTitle}>Pilih Produk &amp; Kuantiti</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Set kuantiti kepada 0 untuk tidak order</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {selections.map((sel, idx) => {
              const activeVariants = (sel.product.product_variants ?? []).filter(v => v.is_active).sort((a, b) => a.sort_order - b.sort_order)
              const hasVariants = activeVariants.length > 0
              const price = sel.selectedVariant ? Number(sel.selectedVariant.price) : Number(sel.product.price)
              const stock = stocks[sel.product.id] ?? null
              const isOutOfStock = stock === 0
              const isActive = sel.qty > 0

              return (
                <div key={sel.product.id} style={{
                  borderRadius: 14, border: `2px solid ${isActive ? cv('--cherry', '#9C0F30') : '#e5e7eb'}`,
                  background: isActive ? cv('--cherry-light', '#fef2f2') : '#fafafa',
                  overflow: 'hidden', transition: 'all 0.15s', opacity: isOutOfStock ? 0.5 : 1,
                }}>
                  {/* Product header row */}
                  <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: '#111', marginBottom: 2, lineHeight: 1.3 }}>{sel.product.name}</p>
                      <p style={{ fontSize: 14, fontWeight: 900, color: cv('--cherry', '#9C0F30') }}>RM{(price * Math.max(sel.qty, 1)).toFixed(2)}</p>
                    </div>
                    {isOutOfStock ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fee2e2', borderRadius: 8, padding: '4px 10px' }}>
                        <PackageX style={{ width: 12, height: 12, color: '#ef4444' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>Habis</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                        <button type="button" onClick={() => updateSelection(idx, { qty: Math.max(0, sel.qty - 1) })}
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ width: 32, textAlign: 'center', fontSize: 15, fontWeight: 900, color: '#111' }}>{sel.qty}</span>
                        <button type="button" onClick={() => updateSelection(idx, { qty: stock !== null ? Math.min(stock, sel.qty + 1) : sel.qty + 1 })}
                          style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${cv('--cherry', '#9C0F30')}`, background: cv('--cherry', '#9C0F30'), fontSize: 16, fontWeight: 700, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    )}
                  </div>

                  {/* Variant chips */}
                  {hasVariants && isActive && (
                    <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {activeVariants.map(variant => {
                        const isSelected = sel.selectedVariant?.id === variant.id
                        return (
                          <button key={variant.id} type="button" onClick={() => updateSelection(idx, { selectedVariant: variant })}
                            style={{
                              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.1s',
                              border: isSelected ? `1.5px solid ${cv('--cherry', '#9C0F30')}` : '1.5px solid #e5e7eb',
                              background: isSelected ? cv('--cherry', '#9C0F30') : '#fff',
                              color: isSelected ? '#fff' : '#374151',
                            }}>
                            {variant.name} · RM{Number(variant.price).toFixed(0)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Running subtotal */}
          {activeSelections.length > 0 && (
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '10px 14px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{activeSelections.length} produk dipilih</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: cv('--cherry', '#9C0F30') }}>RM{subtotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div style={{ height: 8, background: '#f3f4f6', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }} />

        {/* ── STEP 2: Customer Details ── */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={sectionHead}>
            <div style={stepBadge}>2</div>
            <div>
              <p style={stepTitle}>Maklumat Penghantaran</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Semua maklumat adalah selamat &amp; sulit</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>NAMA PENUH</label>
              <input style={inputStyle} type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="cth: Ahmad bin Ali" required />
            </div>
            <div>
              <label style={labelStyle}>NO. TELEFON</label>
              <input style={inputStyle} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="cth: 0123456789" required />
            </div>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: '#92400e', lineHeight: 1.5, marginBottom: 6 }}>
                📧 <strong>Wajib</strong> — resit rasmi &amp; kemaskini status pesanan dihantar ke email anda.
              </div>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="cth: nama@email.com" required />
            </div>

            {/* Penghantaran vs Ambil Sendiri */}
            {pickupEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([['delivery', '🚚 Penghantaran'], ['pickup', '🏪 Ambil Sendiri']] as const).map(([m, label]) => {
                  const active = deliveryMethod === m
                  return (
                    <button key={m} type="button" onClick={() => setDeliveryMethod(m)}
                      style={{
                        padding: '10px 8px', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                        border: active ? `2px solid ${cv('--cherry','#9C0F30')}` : '2px solid #e5e7eb',
                        background: active ? cv('--cherry-light','#fef2f2') : '#fafafa',
                        color: active ? cv('--cherry','#9C0F30') : '#6b7280',
                      }}>{label}</button>
                  )
                })}
              </div>
            )}

            {isPickup ? (
              <>
                <div style={{ background: cv('--cherry-light','#fef2f2'), borderRadius: 12, padding: '12px 14px', fontSize: 12, lineHeight: 1.5, color: '#374151' }}>
                  <p style={{ fontWeight: 800, color: cv('--cherry','#9C0F30'), marginBottom: 2 }}>🏪 Ambil di kedai — SyababFresh, Bangi</p>
                  Kompleks Premis Usahawan SME Bank Bangi, Seksyen 16, 43650 Bandar New Bangi · Isnin–Sabtu, 9 pagi–6 petang
                </div>
                <div>
                  <label style={labelStyle}>TARIKH AMBIL</label>
                  <input style={inputStyle} type="date" value={pickupDate} min={pickupMinDate} onChange={e => setPickupDate(e.target.value)} required />
                </div>
                <div>
                  <label style={labelStyle}>NOTA (PILIHAN)</label>
                  <input style={inputStyle} type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Arahan khas..." />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={labelStyle}>ALAMAT PENGHANTARAN</label>
                  <textarea style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 } as React.CSSProperties} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="No. rumah, jalan, taman, bandar..." required rows={3} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>POSKOD</label>
                    <input style={{ ...inputStyle, borderColor: postcodeBlocked ? '#ef4444' : undefined }} type="text" inputMode="numeric" maxLength={5} value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value.replace(/\D/g, '') }))} placeholder="cth: 47810" required />
                    {postcodeBlocked && <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, marginTop: 4 }}>⚠️ Penghantaran tidak tersedia ke kawasan ini</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>NOTA (PILIHAN)</label>
                    <input style={inputStyle} type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Arahan khas..." />
                  </div>
                </div>
                {slots.length > 0 && (
                  <div>
                    <label style={labelStyle}>MASA PENGHANTARAN</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {slots.map(s => {
                        const active = deliverySlot === s.value
                        return (
                          <button key={s.value} type="button" onClick={() => setDeliverySlot(s.value)}
                            style={{
                              padding: '10px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                              border: active ? `2px solid ${cv('--cherry','#9C0F30')}` : '2px solid #e5e7eb',
                              background: active ? cv('--cherry-light','#fef2f2') : '#fafafa',
                              color: active ? cv('--cherry','#9C0F30') : '#6b7280',
                            }}>{s.label}</button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ height: 8, background: '#f3f4f6', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }} />

        {/* ── STEP 3: Payment + Summary ── */}
        <div style={{ padding: '20px 20px 24px' }}>
          <div style={sectionHead}>
            <div style={stepBadge}>3</div>
            <p style={stepTitle}>Kaedah Bayaran &amp; Sahkan</p>
          </div>

          {paymentMethods.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: paymentMethods.length === 1 ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {paymentMethods.map(pm => (
                <button key={pm.id} type="button" onClick={() => setPaymentMethod(pm.id)}
                  style={{
                    padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                    border: paymentMethod === pm.id ? `2px solid ${cv('--cherry', '#9C0F30')}` : '2px solid #e5e7eb',
                    background: paymentMethod === pm.id ? cv('--cherry-light', '#fef2f2') : '#fafafa',
                  }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: paymentMethod === pm.id ? cv('--cherry', '#9C0F30') : '#111', marginBottom: 2 }}>{pm.label}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>{pm.sublabel}</p>
                </button>
              ))}
            </div>
          )}

          {/* Kod promosi */}
          <div style={{ marginBottom: 14 }}>
            {appliedPromo ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '10px 14px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>🎟️ {appliedPromo.code} — diskaun RM{discount.toFixed(2)}</span>
                <button type="button" onClick={() => { setAppliedPromo(null); setPromoInput('') }} style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Buang</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} placeholder="Kod promosi (pilihan)" />
                <button type="button" onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                  style={{ padding: '0 18px', borderRadius: 12, border: 'none', background: cv('--cherry','#9C0F30'), color: '#fff', fontWeight: 800, fontSize: 13, cursor: promoLoading || !promoInput.trim() ? 'not-allowed' : 'pointer', opacity: promoLoading || !promoInput.trim() ? 0.5 : 1 }}>
                  {promoLoading ? '...' : 'Guna'}
                </button>
              </div>
            )}
          </div>

          {/* Mata Loyalty (login-pilihan) */}
          {loyalty.loggedIn ? (loyalty.points > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>⭐ Mata Loyalty</p>
                <p style={{ fontSize: 11, color: '#a16207' }}>{loyalty.points} mata · jimat hingga RM{(loyalty.points / 100).toFixed(2)}</p>
              </div>
              <button type="button" onClick={() => setUsePoints(v => !v)}
                style={{ padding: '6px 16px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: usePoints ? '#16a34a' : '#e5e7eb', color: usePoints ? '#fff' : '#6b7280' }}>
                {usePoints ? '✓ Guna' : 'Guna'}
              </button>
            </div>
          )) : (
            <button type="button" onClick={() => { window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname) }}
              style={{ width: '100%', textAlign: 'center', padding: 10, borderRadius: 12, border: '1.5px dashed #fde68a', background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
              🔓 Log masuk untuk guna Mata Loyalty
            </button>
          )}

          {/* Order summary */}
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid #e5e7eb', marginBottom: 16 }}>
            <div style={{ background: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag style={{ width: 13, height: 13, color: '#9ca3af' }} />
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em' }}>RINGKASAN PESANAN</p>
            </div>
            <div style={{ padding: '12px 16px', background: '#fff' }}>
              {activeSelections.map((s, i) => {
                const price = s.selectedVariant ? Number(s.selectedVariant.price) : Number(s.product.price)
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 8 }}>
                    <span style={{ flex: 1, marginRight: 8 }}>{s.product.name}{s.selectedVariant ? ` · ${s.selectedVariant.name}` : ''} × {s.qty}</span>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>RM{(price * s.qty).toFixed(2)}</span>
                  </div>
                )
              })}
              {activeSelections.length === 0 && (
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>Tiada produk dipilih</p>
              )}
              {appliedPromo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a', marginBottom: 8 }}>
                  <span>Diskaun ({appliedPromo.code})</span>
                  <span style={{ fontWeight: 700 }}>−RM{discount.toFixed(2)}</span>
                </div>
              )}
              {ptsDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d97706', marginBottom: 8 }}>
                  <span>⭐ Mata Loyalty</span>
                  <span style={{ fontWeight: 700 }}>−RM{ptsDiscount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: 8, marginTop: 4, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Truck style={{ width: 13, height: 13 }} /> {isPickup ? 'Ambil Sendiri' : 'Penghantaran'}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {isPickup
                    ? <span style={{ color: '#16a34a', fontWeight: 800 }}>PERCUMA ✓</span>
                    : postcodeBlocked
                    ? <span style={{ color: '#ef4444', fontWeight: 800 }}>Tidak tersedia ✗</span>
                    : deliveryFee !== null
                      ? deliveryFee === 0
                        ? <span style={{ color: '#16a34a', fontWeight: 800 }}>PERCUMA ✓</span>
                        : `RM${deliveryFee.toFixed(2)}${fetchingFee ? '...' : ''}`
                      : fetchingFee ? '...'
                        : freeOn && subtotal >= FREE_MIN ? <span style={{ color: '#16a34a', fontWeight: 800 }}>PERCUMA ✓</span>
                        : <span style={{ color: '#9ca3af' }}>Isi poskod</span>}
                </span>
              </div>
              {!isPickup && freeOn && subtotal > 0 && subtotal < FREE_MIN && (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '7px 10px', marginBottom: 8, fontSize: 11, color: '#166534', fontWeight: 600 }}>
                  🎁 Tambah RM{(FREE_MIN - subtotal).toFixed(2)} lagi untuk penghantaran <strong>PERCUMA</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #f3f4f6', paddingTop: 10 }}>
                <span style={{ fontWeight: 900, fontSize: 15, color: '#111' }}>JUMLAH</span>
                <span style={{ fontWeight: 900, fontSize: 20, color: cv('--cherry', '#9C0F30') }}>
                  RM{total.toFixed(2)}{!isPickup && deliveryFee === null && subtotal < FREE_MIN && subtotal > 0 ? '+' : ''}
                </span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={submitting || activeSelections.length === 0 || postcodeBad}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: 16, borderRadius: 14, border: 'none',
              cursor: submitting || activeSelections.length === 0 || postcodeBad ? 'not-allowed' : 'pointer',
              background: submitting || activeSelections.length === 0 || postcodeBad ? '#9ca3af' : cv('--cherry', '#9C0F30'),
              color: '#fff', fontWeight: 900, fontSize: 16, fontFamily: 'inherit',
              boxShadow: activeSelections.length === 0 || postcodeBad ? 'none' : '0 6px 24px rgba(156,15,48,0.35)',
              transition: 'all 0.2s',
            }}>
            <Lock style={{ width: 16, height: 16 }} />
            {submitting ? 'Menghantar...' : `Sahkan Pesanan${activeSelections.length > 0 ? ` — RM${total.toFixed(2)}` : ''}`}
            {!submitting && <ChevronRight style={{ width: 18, height: 18 }} />}
          </button>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Lock style={{ width: 10, height: 10 }} /> Maklumat anda selamat &amp; dilindungi
          </p>
        </div>
      </form>
    </div>
  )
}
