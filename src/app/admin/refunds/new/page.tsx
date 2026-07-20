'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Search, Loader2, Plus, Trash2, ImageIcon, X,
  Banknote, Gift, Package, AlertTriangle,
} from 'lucide-react'
import { calcItemRefund, calcRefundTotal } from '@/lib/refund-calc'
import type { RefundCalcMethod, RefundPaymentMethod } from '@/lib/refund-calc'

interface FormItem {
  key: string
  order_item_id: string | null
  product_name: string
  variant_name: string | null
  unit_price: string
  quantity: string
  calc_method: RefundCalcMethod
  rosak_qty: string
  percent_rosak: string
  ganti_saiz: string
}

interface OrderInfo {
  id: string
  order_number: string
  total: number
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  items: { id: string; product_name: string; quantity: number; unit_price: number }[]
}

function newKey() { return Math.random().toString(36).slice(2) }

function NewRefundInner() {
  const router = useRouter()
  const preOrderId = useSearchParams().get('orderId') || ''

  const [orderSearch, setOrderSearch] = useState(preOrderId)
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [existingRefunds, setExistingRefunds] = useState<{ id: string; status: string; jumlah_refund: number }[]>([])
  const [searching, setSearching] = useState(false)

  const [items, setItems] = useState<FormItem[]>([])
  const [picName, setPicName] = useState('')
  const [supplierCode, setSupplierCode] = useState('')
  const [supplierClaim, setSupplierClaim] = useState('')
  const [reason, setReason] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<RefundPaymentMethod>('transfer')

  // transfer
  const [bankName, setBankName] = useState('')
  const [bankAccountNo, setBankAccountNo] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  // baucar
  const [baucarKod, setBaucarKod] = useState('')
  // ganti
  const [gantiQty, setGantiQty] = useState('')
  const [gantiVariation, setGantiVariation] = useState('')
  const [gantiAlamat, setGantiAlamat] = useState('')
  const [gantiPostcode, setGantiPostcode] = useState('')

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const searchOrder = useCallback(async (q: string) => {
    if (!q.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/admin/refunds/lookup?q=${encodeURIComponent(q.trim())}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Order tidak dijumpai'); setOrder(null); return }
      const o: OrderInfo = data.order
      setOrder(o)
      setExistingRefunds(data.existingRefunds ?? [])
      setGantiAlamat(o.delivery_address ?? '')
      setItems(o.items.map(it => ({
        key: newKey(),
        order_item_id: it.id,
        product_name: it.product_name,
        variant_name: null,
        unit_price: String(it.unit_price),
        quantity: String(it.quantity),
        calc_method: 'per_unit',
        rosak_qty: '',
        percent_rosak: '',
        ganti_saiz: '',
      })))
    } finally { setSearching(false) }
  }, [])

  useEffect(() => { if (preOrderId) searchOrder(preOrderId) }, [preOrderId, searchOrder])

  function patchItem(key: string, patch: Partial<FormItem>) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it))
  }
  function removeItem(key: string) { setItems(prev => prev.filter(it => it.key !== key)) }
  function addItem() {
    setItems(prev => [...prev, {
      key: newKey(), order_item_id: null, product_name: '', variant_name: null,
      unit_price: '', quantity: '1', calc_method: 'per_unit', rosak_qty: '', percent_rosak: '', ganti_saiz: '',
    }])
  }

  const total = calcRefundTotal(items)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch('/api/admin/refunds/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (res.ok && data.url) setImageUrls(prev => [...prev, data.url])
        else toast.error(data.error || 'Gagal upload')
      }
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function submit() {
    if (!order) { toast.error('Pilih order dahulu'); return }
    if (items.length === 0) { toast.error('Tambah sekurang-kurangnya satu item'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          pic_name: picName, supplier_code: supplierCode, supplier_claim: supplierClaim,
          reason, payment_method: paymentMethod,
          baucar_kod: baucarKod,
          bank_name: bankName, bank_account_no: bankAccountNo, bank_account_name: bankAccountName,
          ganti_qty: gantiQty, ganti_variation: gantiVariation, ganti_alamat: gantiAlamat,
          ganti_postcode: gantiPostcode,
          image_urls: imageUrls, notes,
          items: items.map(it => ({
            order_item_id: it.order_item_id, product_name: it.product_name, variant_name: it.variant_name,
            unit_price: it.unit_price, quantity: it.quantity, calc_method: it.calc_method,
            rosak_qty: it.rosak_qty, percent_rosak: it.percent_rosak, ganti_saiz: it.ganti_saiz,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Gagal cipta refund'); return }
      toast.success('Refund dicipta')
      router.push(`/admin/refunds/${data.id}`)
    } finally { setSubmitting(false) }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/30 focus:border-red-400 outline-none'

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      <Link href="/admin/refunds" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Refund Baru</h1>

      {/* Order lookup */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
        <label className="text-sm font-semibold text-gray-700">No. Order</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchOrder(orderSearch)}
              placeholder="cth: SYB-20260530-0001" className={`${inputCls} pl-9`} />
          </div>
          <button onClick={() => searchOrder(orderSearch)} disabled={searching}
            className="px-4 py-2 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 disabled:opacity-50">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cari'}
          </button>
        </div>

        {order && (
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <p className="font-semibold text-gray-900">{order.customer_name ?? '—'} · <span className="font-mono">{order.order_number}</span></p>
            <p className="text-gray-500 text-xs mt-0.5">{order.customer_phone ?? ''} · Total RM{Number(order.total).toFixed(2)}</p>
            {existingRefunds.length > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                <AlertTriangle className="h-3 w-3" /> Order ni dah ada {existingRefunds.length} refund
              </p>
            )}
          </div>
        )}
      </section>

      {order && (
        <>
          {/* Items */}
          <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Item Refund</h2>
              <button onClick={addItem} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline">
                <Plus className="h-3.5 w-3.5" /> Tambah item
              </button>
            </div>
            {items.map(it => (
              <div key={it.key} className="border border-gray-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={it.product_name} onChange={e => patchItem(it.key, { product_name: e.target.value })}
                    placeholder="Nama produk" className={`${inputCls} flex-1`} />
                  <button onClick={() => removeItem(it.key)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Harga seunit (RM)</label>
                    <input value={it.unit_price} onChange={e => patchItem(it.key, { unit_price: e.target.value })} type="number" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Kuantiti dipesan</label>
                    <input value={it.quantity} onChange={e => patchItem(it.key, { quantity: e.target.value })} type="number" className={inputCls} />
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                  {(['per_unit', 'percentage'] as RefundCalcMethod[]).map(m => (
                    <button key={m} onClick={() => patchItem(it.key, { calc_method: m })}
                      className={`px-3 py-1 text-xs font-semibold rounded-md ${it.calc_method === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                      {m === 'per_unit' ? 'Per Unit' : 'Peratus'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 items-end">
                  {it.calc_method === 'per_unit' ? (
                    <div>
                      <label className="text-xs text-gray-400">Bilangan rosak</label>
                      <input value={it.rosak_qty} onChange={e => patchItem(it.key, { rosak_qty: e.target.value })} type="number" className={inputCls} />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-400">% rosak</label>
                      <input value={it.percent_rosak} onChange={e => patchItem(it.key, { percent_rosak: e.target.value })} type="number" className={inputCls} />
                    </div>
                  )}
                  <p className="text-right text-sm font-bold text-gray-900 pb-2">RM{calcItemRefund(it).toFixed(2)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-600">Jumlah Refund</span>
              <span className="text-2xl font-black text-red-600">RM{total.toFixed(2)}</span>
            </div>
          </section>

          {/* Pemprosesan */}
          <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400">PIC (admin)</label><input value={picName} onChange={e => setPicName(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-gray-400">Sebab refund</label><input value={reason} onChange={e => setReason(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-gray-400">Kod supplier (opsyenal)</label><input value={supplierCode} onChange={e => setSupplierCode(e.target.value)} className={inputCls} /></div>
            <div><label className="text-xs text-gray-400">Tuntutan supplier RM (opsyenal)</label><input value={supplierClaim} onChange={e => setSupplierClaim(e.target.value)} type="number" className={inputCls} /></div>
          </section>

          {/* Cara bayar */}
          <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Cara Bayar Balik</h2>
            <div className="grid grid-cols-3 gap-2">
              {([
                { m: 'transfer', label: 'Transfer', icon: Banknote },
                { m: 'baucar', label: 'Baucar/Points', icon: Gift },
                { m: 'ganti_produk', label: 'Ganti Produk', icon: Package },
              ] as { m: RefundPaymentMethod; label: string; icon: typeof Banknote }[]).map(({ m, label, icon: Icon }) => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-semibold ${paymentMethod === m ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-100 text-gray-500'}`}>
                  <Icon className="h-5 w-5" /> {label}
                </button>
              ))}
            </div>

            {paymentMethod === 'transfer' && (
              <div className="grid grid-cols-3 gap-2">
                <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Nama bank" className={inputCls} />
                <input value={bankAccountNo} onChange={e => setBankAccountNo(e.target.value)} placeholder="No. akaun" className={inputCls} />
                <input value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} placeholder="Nama pemilik" className={inputCls} />
              </div>
            )}
            {paymentMethod === 'baucar' && (
              <div className="space-y-1.5">
                <input value={baucarKod} onChange={e => setBaucarKod(e.target.value.toUpperCase())}
                  placeholder="Kod baucar (kosongkan untuk auto-jana, cth RF-XXXXXX)" className={inputCls} />
                <p className="text-xs text-gray-400">
                  Kod promo bernilai <span className="font-semibold text-gray-600">RM{total.toFixed(2)}</span> dijana bila status → Selesai. Customer taip kod ini di checkout (sah 90 hari, 1 kali guna).
                </p>
              </div>
            )}
            {paymentMethod === 'ganti_produk' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={gantiQty} onChange={e => setGantiQty(e.target.value)} type="number" placeholder="Kuantiti ganti" className={inputCls} />
                  <input value={gantiVariation} onChange={e => setGantiVariation(e.target.value)} placeholder="Saiz / variasi" className={inputCls} />
                  <input value={gantiAlamat} onChange={e => setGantiAlamat(e.target.value)} placeholder="Alamat" className={`${inputCls} col-span-2`} />
                  <input value={gantiPostcode} onChange={e => setGantiPostcode(e.target.value)} placeholder="Poskod" className={inputCls} />
                </div>
                <p className="text-xs text-gray-400">Kurier & no. tracking ditetapkan di halaman detail refund selepas simpan — ia mencipta shipment sebenar dalam modul Shipping.</p>
              </div>
            )}
          </section>

          {/* Bukti + notes */}
          <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Bukti & Catatan</h2>
            <div className="flex flex-wrap gap-2">
              {imageUrls.map(url => (
                <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="bukti" className="w-full h-full object-cover" />
                  <button onClick={() => setImageUrls(prev => prev.filter(u => u !== url))}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-red-300">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleUpload} />
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan…" rows={2} className={inputCls} />
          </section>

          <button onClick={submit} disabled={submitting}
            className="w-full py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 shadow-sm inline-flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan Refund
          </button>
        </>
      )}
    </div>
  )
}

export default function NewRefundPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Memuatkan…</div>}>
      <NewRefundInner />
    </Suspense>
  )
}
