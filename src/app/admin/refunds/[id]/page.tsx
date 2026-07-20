'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Pencil, Trash2, MessageCircle, Truck, CheckCircle2,
} from 'lucide-react'
import { PAYMENT_LABELS, STATUS_LABELS } from '@/lib/refund-calc'
import type { RefundStatus } from '@/lib/refund-calc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Refund = any

// Diisytihar di luar render — elak remount + reset state setiap kali parent render.
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return value ? <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-gray-50 last:border-0"><span className="text-gray-400">{label}</span><span className="text-gray-800 font-medium text-right">{value}</span></div> : null
}

const statusStyle: Record<RefundStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  selesai: 'bg-green-100 text-green-700',
}

export default function RefundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [r, setR] = useState<Refund | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Shipment ganti (carrier sebenar)
  const [carriers, setCarriers] = useState<{ id: string; name: string; is_active: boolean }[]>([])
  const [shipCarrier, setShipCarrier] = useState('')
  const [shipTracking, setShipTracking] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/refunds/${id}`)
    const data = await res.json()
    if (res.ok) {
      setR(data)
      setShipCarrier(prev => prev || '')
      setShipTracking(prev => prev || data.ganti_tracking_no || '')
    }
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/admin/shipping/carriers').then(r => r.json()).then(d => Array.isArray(d) && setCarriers(d)).catch(() => {})
  }, [])

  async function saveGantiShipment() {
    if (!shipCarrier) { toast.error('Pilih kurier'); return }
    setBusy(true)
    const res = await fetch(`/api/admin/refunds/${id}/ganti-shipment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carrier_id: shipCarrier, tracking_number: shipTracking }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { toast.success('Shipment ganti disimpan'); load() }
    else toast.error(data.error || 'Gagal simpan shipment')
  }

  async function setStatus(status: RefundStatus) {
    setBusy(true)
    const res = await fetch(`/api/admin/refunds/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    setBusy(false)
    if (res.ok) { toast.success(`Status → ${STATUS_LABELS[status]}`); load() }
    else toast.error('Gagal kemaskini status')
  }

  async function wa(kind: 'wa-customer' | 'wa-tracking') {
    setBusy(true)
    const res = await fetch(`/api/admin/refunds/${id}/${kind}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) toast.success('WA dihantar')
    else toast.error(data.error || 'Gagal hantar WA')
  }

  async function del() {
    if (!confirm('Padam refund ini?')) return
    const res = await fetch(`/api/admin/refunds/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Dipadam'); router.push('/admin/refunds') }
    else toast.error('Gagal padam')
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Memuatkan…</div>
  if (!r) return <div className="p-6 text-sm text-gray-400">Refund tidak dijumpai.</div>

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      <Link href="/admin/refunds" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{r.order_number}</h1>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[r.status as RefundStatus]}`}>{STATUS_LABELS[r.status as RefundStatus]}</span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{r.customer_name ?? '—'} · {r.customer_phone ?? ''}</p>
        </div>
        <p className="text-3xl font-black text-red-600">RM{Number(r.jumlah_refund).toFixed(2)}</p>
      </div>

      {/* Status actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['pending', 'processing', 'selesai'] as RefundStatus[]).map(s => (
          <button key={s} onClick={() => setStatus(s)} disabled={busy || r.status === s}
            className={`px-3 py-1.5 text-sm font-semibold rounded-xl border ${r.status === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'} disabled:opacity-50`}>
            {s === 'selesai' && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />}{STATUS_LABELS[s]}
          </button>
        ))}
        <div className="flex-1" />
        <Link href={`/admin/refunds/${id}/edit`} className="p-2 text-gray-500 hover:text-gray-800"><Pencil className="h-4 w-4" /></Link>
        <button onClick={del} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </div>

      {/* Items */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Item</h2>
        {(r.items ?? []).map((it: Refund) => (
          <div key={it.id} className="flex justify-between gap-4 py-1.5 text-sm border-b border-gray-50 last:border-0">
            <span className="text-gray-700">{it.product_name} {it.calc_method === 'per_unit' ? `(${it.rosak_qty ?? 0} rosak)` : `(${it.percent_rosak ?? 0}%)`}</span>
            <span className="font-semibold text-gray-900">RM{Number(it.item_refund).toFixed(2)}</span>
          </div>
        ))}
      </section>

      {/* Maklumat */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Maklumat</h2>
        <Row label="Cara bayar" value={PAYMENT_LABELS[r.payment_method as keyof typeof PAYMENT_LABELS]} />
        <Row label="Sebab" value={r.reason} />
        <Row label="PIC" value={r.pic_name} />
        <Row label="Supplier" value={r.supplier_code} />
        <Row label="Tuntutan supplier" value={r.supplier_claim ? `RM${Number(r.supplier_claim).toFixed(2)}` : null} />
        <Row label="Deadline" value={new Date(r.deadline).toLocaleDateString('en-MY')} />
        {r.payment_method === 'transfer' && <>
          <Row label="Bank" value={r.bank_name} />
          <Row label="No. akaun" value={r.bank_account_no} />
          <Row label="Nama akaun" value={r.bank_account_name} />
        </>}
        {r.payment_method === 'baucar' && <>
          <Row label="Kod baucar" value={r.baucar_kod
            ? <span className="font-mono font-bold text-red-600">{r.baucar_kod}</span>
            : <span className="text-gray-400 italic">dijana bila Selesai</span>} />
          {r.baucar_kod && <Row label="Nilai baucar" value={`RM${Number(r.jumlah_refund).toFixed(2)} · taip di checkout (sah 90 hari)`} />}
        </>}
        {r.payment_method === 'ganti_produk' && <>
          <Row label="Ganti qty" value={r.ganti_qty} />
          <Row label="Variasi" value={r.ganti_variation} />
          <Row label="Alamat" value={r.ganti_alamat} />
          <Row label="Kurier" value={r.ganti_courier} />
          <Row label="Tracking" value={r.ganti_tracking_no || r.ganti_tracking_link} />
        </>}
        <Row label="Catatan" value={r.notes} />
      </section>

      {/* Bukti */}
      {(r.image_urls ?? []).length > 0 && (
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Bukti</h2>
          <div className="flex flex-wrap gap-2">
            {r.image_urls.map((url: string) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="bukti" className="w-24 h-24 object-cover rounded-lg border border-gray-200" /></a>
            ))}
          </div>
        </section>
      )}

      {/* Shipment Ganti — integrasi modul shipping sebenar */}
      {r.payment_method === 'ganti_produk' && (
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-bold text-gray-900">Shipment Ganti</h2>
          </div>
          {r.ganti_tracking_no && (
            <p className="text-sm text-gray-600">
              Tracking semasa: <span className="font-mono font-semibold">{r.ganti_tracking_no}</span>
              {r.ganti_tracking_link && <> · <a href={r.ganti_tracking_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Jejak</a></>}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <select value={shipCarrier} onChange={e => setShipCarrier(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500/30">
              <option value="">Pilih kurier…</option>
              {carriers.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={shipTracking} onChange={e => setShipTracking(e.target.value)} placeholder="No. tracking"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500/30" />
          </div>
          <button onClick={saveGantiShipment} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Simpan Shipment Ganti
          </button>
          <p className="text-xs text-gray-400">Shipment ini muncul dalam modul Shipping (berasingan dari penghantaran asal order) & jejak auto-jana dari kurier.</p>
        </section>
      )}

      {/* WA actions */}
      <div className="flex items-center gap-2">
        <button onClick={() => wa('wa-customer')} disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} WA Customer
        </button>
        {r.payment_method === 'ganti_produk' && (
          <button onClick={() => wa('wa-tracking')} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 disabled:opacity-50">
            <Truck className="h-4 w-4" /> WA Tracking
          </button>
        )}
      </div>
    </div>
  )
}
