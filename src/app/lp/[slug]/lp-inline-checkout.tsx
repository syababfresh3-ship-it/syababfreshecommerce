'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { CheckCircle, MessageCircle, ChevronRight, Lock, Truck, Tag } from 'lucide-react'
import type { Product, ProductVariant } from '@/types'

interface Props {
  product: Product & { product_variants?: ProductVariant[] }
  stock: number | null
  slug: string
  freeMin?: number
}

interface PaymentMethod { id: string; label: string; sublabel: string }

const v = (name: string, fallback: string) => `var(${name}, ${fallback})`

export function LpInlineCheckout({ product, stock, slug, freeMin = 80 }: Props) {
  const activeVariants = (product.product_variants ?? [])
    .filter(v => v.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
  const hasVariants = activeVariants.length > 0

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    hasVariants ? activeVariants[0] : null
  )
  const [qty, setQty] = useState(1)
  const [form, setForm] = useState({ name: '', phone: '', address: '', postcode: '', notes: '' })
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null)
  const [fetchingFee, setFetchingFee] = useState(false)
  const [postcodeBlocked, setPostcodeBlocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ order_number: string; total: number; payment_method: string } | null>(null)

  const displayPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price)
  const comparePrice = selectedVariant ? selectedVariant.compare_price : product.compare_price
  const subtotal = displayPrice * qty
  const FREE_MIN = freeMin
  const total = subtotal + (deliveryFee ?? 0)
  const savedAmt = comparePrice && Number(comparePrice) > displayPrice ? (Number(comparePrice) - displayPrice) * qty : 0

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
      const r = await fetch(`/api/lp/${slug}/order?postcode=${postcode}&subtotal=${subtotal}&qty=${qty}`)
      const d = await r.json()
      if (d.available === false) { setPostcodeBlocked(true); setDeliveryFee(null); return }
      setPostcodeBlocked(false)
      setDeliveryFee(d.fee ?? 15)
    } catch { setDeliveryFee(15); setPostcodeBlocked(false) }
    finally { setFetchingFee(false) }
  }, [slug, subtotal, qty])

  useEffect(() => { fetchFee(form.postcode) }, [form.postcode, fetchFee])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (hasVariants && !selectedVariant) { toast.error('Sila pilih saiz'); return }
    if (!form.name.trim()) { toast.error('Sila masukkan nama'); return }
    if (!form.phone.trim()) { toast.error('Sila masukkan no. telefon'); return }
    if (!form.address.trim() || form.address.trim().length < 10) { toast.error('Sila masukkan alamat lengkap'); return }
    if (!paymentMethod) { toast.error('Sila pilih kaedah bayaran'); return }

    const params = new URLSearchParams(window.location.search)
    const source = [params.get('utm_source'), params.get('utm_campaign')].filter(Boolean).join('/') || null

    setSubmitting(true)
    try {
      const res = await fetch(`/api/lp/${slug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), phone: form.phone.trim(),
          address: form.address.trim(), postcode: form.postcode.trim() || null,
          notes: form.notes.trim() || null, payment_method: paymentMethod, source,
          items: [{ product_id: product.id, variant_id: selectedVariant?.id ?? null,
            product_name: product.name, variant_name: selectedVariant?.name ?? null,
            quantity: qty, unit_price: displayPrice }],
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
    const variantLine = selectedVariant ? ` (${selectedVariant.name})` : ''
    const msg = encodeURIComponent(
      `Assalamualaikum! Saya ingin sahkan pesanan:\n\n` +
      `• ${product.name}${variantLine} × ${qty} — RM${(displayPrice * qty).toFixed(2)}\n\n` +
      `🔢 No. Pesanan: *${result.order_number}*\n` +
      `💰 Jumlah: *RM${result.total.toFixed(2)}*\n` +
      `🏠 Alamat: ${form.address}\n\nTerima kasih!`
    )
    window.open(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT ?? ''}?text=${msg}`, '_blank', 'noopener')
  }

  /* ── SOLD OUT ── */
  if (stock === 0) return (
    <div style={{ borderRadius: 20, padding: '32px 24px', textAlign: 'center', background: '#fafafa', border: '2px solid #e5e7eb' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
      <p style={{ fontWeight: 800, fontSize: 18, color: v('--cherry','#9C0F30'), marginBottom: 6 }}>Stok Habis</p>
      <p style={{ fontSize: 14, color: '#6b7280' }}>Produk ini telah kehabisan stok. Nantikan batch seterusnya!</p>
    </div>
  )

  /* ── SUCCESS ── */
  if (result) return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: v('--cream','#fff'), border: `2px solid ${v('--cherry-border','#fecaca')}` }}>
      <div style={{ background: v('--cherry','#9C0F30'), padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <CheckCircle style={{ width: 32, height: 32, color: '#fff' }} />
        </div>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: '#fff', marginBottom: 4 }}>Pesanan Diterima!</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Team kami akan hubungi anda untuk pengesahan bayaran</p>
      </div>
      <div style={{ padding: '20px 20px 24px' }}>
        <div style={{ background: v('--cherry-light','#fef2f2'), borderRadius: 14, padding: '16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
            <span>No. Pesanan</span>
            <span style={{ fontWeight: 900, fontFamily: 'monospace', color: v('--cherry','#9C0F30') }}>{result.order_number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
            <span>Produk</span>
            <span style={{ fontWeight: 700, color: '#111', textAlign: 'right', maxWidth: '55%' }}>{product.name}{selectedVariant ? ` · ${selectedVariant.name}` : ''}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: '#6b7280' }}>
            <span>Kaedah Bayar</span>
            <span style={{ fontWeight: 600 }}>{paymentMethods.find(p => p.id === result.payment_method)?.label ?? result.payment_method}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1.5px solid ${v('--cherry-border','#fecaca')}`, paddingTop: 10, fontWeight: 900, fontSize: 16 }}>
            <span>Jumlah Bayaran</span>
            <span style={{ color: v('--cherry','#9C0F30') }}>RM{result.total.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={waConfirm} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          <MessageCircle style={{ width: 20, height: 20 }} fill="white" strokeWidth={0} />
          Sahkan Pesanan via WhatsApp
        </button>
      </div>
    </div>
  )

  /* ── MAIN FORM ── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 14,
    border: `1.5px solid ${v('--cherry-border','#e5e7eb')}`,
    background: '#fff', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', color: '#111',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, letterSpacing: '0.04em' }
  const sectionHeadStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }
  const stepBadge = (_: string) => ({
    width: 26, height: 26, borderRadius: '50%', background: v('--cherry','#9C0F30'),
    color: '#fff', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  } as React.CSSProperties)
  const stepTitle: React.CSSProperties = { fontWeight: 800, fontSize: 14, color: '#111', letterSpacing: '0.03em' }

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', background: v('--cream','#fff'), boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}>

      {/* ── HEADER ── */}
      <div style={{ background: v('--cherry','#9C0F30'), padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Borang Pesanan</p>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: '#fff', lineHeight: 1.2 }}>{product.name}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: v('--gold-light','#F5BC2F'), lineHeight: 1 }}>RM{(displayPrice * qty).toFixed(2)}</p>
          {comparePrice && Number(comparePrice) > displayPrice && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through', marginTop: 2 }}>RM{(Number(comparePrice) * qty).toFixed(2)}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ── STEP 1: Variant + Qty ── */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={sectionHeadStyle}>
            <div style={stepBadge('1')}>1</div>
            <div>
              <p style={stepTitle}>Pilih Saiz &amp; Kuantiti</p>
              {savedAmt > 0 && <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 1 }}>Jimat RM{savedAmt.toFixed(2)}!</p>}
            </div>
          </div>

          {hasVariants && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {activeVariants.map(variant => {
                const isSelected = selectedVariant?.id === variant.id
                const varSaved = variant.compare_price && Number(variant.compare_price) > Number(variant.price)
                  ? Number(variant.compare_price) - Number(variant.price) : 0
                return (
                  <button key={variant.id} type="button" onClick={() => setSelectedVariant(variant)}
                    style={{
                      flex: '1 1 calc(33% - 6px)', minWidth: 80, padding: '10px 8px', borderRadius: 12,
                      border: isSelected ? `2px solid ${v('--cherry','#9C0F30')}` : '2px solid #e5e7eb',
                      background: isSelected ? v('--cherry-light','#fef2f2') : '#fafafa',
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                      boxShadow: isSelected ? `0 0 0 3px ${v('--cherry-border','rgba(156,15,48,0.15)')}` : 'none',
                    }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: isSelected ? v('--cherry','#9C0F30') : '#374151', marginBottom: 2 }}>{variant.name}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: isSelected ? v('--cherry','#9C0F30') : '#6b7280' }}>RM{Number(variant.price).toFixed(0)}</p>
                    {varSaved > 0 && <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, marginTop: 1 }}>-RM{varSaved.toFixed(0)}</p>}
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', borderRadius: 12, padding: '10px 14px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Kuantiti</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid #e5e7eb`, background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ width: 36, textAlign: 'center', fontSize: 16, fontWeight: 900, color: '#111' }}>{qty}</span>
              <button type="button" onClick={() => setQty(q => stock !== null ? Math.min(stock, q + 1) : q + 1)}
                style={{ width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${v('--cherry','#9C0F30')}`, background: v('--cherry','#9C0F30'), fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{ height: 8, background: '#f3f4f6', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }} />

        {/* ── STEP 2: Customer Details ── */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={sectionHeadStyle}>
            <div style={stepBadge('2')}>2</div>
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
              <label style={labelStyle}>ALAMAT PENGHANTARAN</label>
              <textarea style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 } as React.CSSProperties} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="No. rumah, jalan, taman, bandar..." required rows={3} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>POSKOD</label>
                <input style={{ ...inputStyle, borderColor: postcodeBlocked ? '#ef4444' : undefined }} type="text" inputMode="numeric" maxLength={5} value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value.replace(/\D/g, '') }))} placeholder="cth: 47810" />
                {postcodeBlocked && <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, marginTop: 4 }}>⚠️ Penghantaran tidak tersedia ke kawasan ini</p>}
              </div>
              <div>
                <label style={labelStyle}>NOTA (PILIHAN)</label>
                <input style={inputStyle} type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Arahan khas..." />
              </div>
            </div>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{ height: 8, background: '#f3f4f6', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }} />

        {/* ── STEP 3: Payment + Summary ── */}
        <div style={{ padding: '20px 20px 24px' }}>
          <div style={sectionHeadStyle}>
            <div style={stepBadge('3')}>3</div>
            <p style={stepTitle}>Kaedah Bayaran &amp; Sahkan</p>
          </div>

          {paymentMethods.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: paymentMethods.length === 1 ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {paymentMethods.map(pm => (
                <button key={pm.id} type="button" onClick={() => setPaymentMethod(pm.id)}
                  style={{
                    padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                    border: paymentMethod === pm.id ? `2px solid ${v('--cherry','#9C0F30')}` : '2px solid #e5e7eb',
                    background: paymentMethod === pm.id ? v('--cherry-light','#fef2f2') : '#fafafa',
                  }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: paymentMethod === pm.id ? v('--cherry','#9C0F30') : '#111', marginBottom: 2 }}>{pm.label}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>{pm.sublabel}</p>
                </button>
              ))}
            </div>
          )}

          {/* Order Summary Card */}
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1.5px solid #e5e7eb', marginBottom: 16 }}>
            <div style={{ background: '#f9fafb', padding: '10px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag style={{ width: 13, height: 13, color: '#9ca3af' }} />
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em' }}>RINGKASAN PESANAN</p>
              </div>
            </div>
            <div style={{ padding: '12px 16px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                <span>{product.name}{selectedVariant ? ` · ${selectedVariant.name}` : ''} × {qty}</span>
                <span style={{ fontWeight: 700, color: '#111' }}>RM{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 10, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Truck style={{ width: 13, height: 13 }} /> Penghantaran
                </span>
                <span style={{ fontWeight: 700 }}>
                  {postcodeBlocked
                    ? <span style={{ color: '#ef4444', fontWeight: 800 }}>Tidak tersedia ✗</span>
                    : deliveryFee !== null
                      ? deliveryFee === 0
                        ? <span style={{ color: '#16a34a', fontWeight: 800 }}>PERCUMA ✓</span>
                        : `RM${deliveryFee.toFixed(2)}${fetchingFee ? '...' : ''}`
                      : fetchingFee ? '...'
                        : subtotal >= FREE_MIN ? <span style={{ color: '#16a34a', fontWeight: 800 }}>PERCUMA ✓</span>
                        : <span style={{ color: '#9ca3af' }}>Isi poskod</span>}
                </span>
              </div>
              {subtotal < FREE_MIN && (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '7px 10px', marginBottom: 10, fontSize: 11, color: '#166534', fontWeight: 600 }}>
                  🎁 Tambah RM{(FREE_MIN - subtotal).toFixed(2)} lagi untuk penghantaran <strong>PERCUMA</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #f3f4f6', paddingTop: 10 }}>
                <span style={{ fontWeight: 900, fontSize: 15, color: '#111' }}>JUMLAH</span>
                <span style={{ fontWeight: 900, fontSize: 20, color: v('--cherry','#9C0F30') }}>
                  RM{total.toFixed(2)}{deliveryFee === null && subtotal < FREE_MIN ? '+' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={submitting || postcodeBlocked}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '16px', borderRadius: 14, border: 'none', cursor: submitting || postcodeBlocked ? 'not-allowed' : 'pointer',
              background: submitting || postcodeBlocked ? '#9ca3af' : v('--cherry','#9C0F30'),
              color: '#fff', fontWeight: 900, fontSize: 16, fontFamily: 'inherit',
              boxShadow: submitting || postcodeBlocked ? 'none' : '0 6px 24px rgba(156,15,48,0.35)',
              transition: 'all 0.2s',
            }}>
            {submitting ? 'Menghantar...' : (
              <>
                <Lock style={{ width: 16, height: 16 }} />
                Sahkan Pesanan
                <ChevronRight style={{ width: 18, height: 18 }} />
              </>
            )}
          </button>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Lock style={{ width: 10, height: 10 }} /> Maklumat anda selamat &amp; dilindungi
          </p>
        </div>
      </form>
    </div>
  )
}
