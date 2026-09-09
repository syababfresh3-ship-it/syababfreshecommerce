'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, X, Check, MapPin, Calendar, Clock, AlertTriangle } from 'lucide-react'

// Kad "Penghantaran" order storefront (SYB-) dengan edit inline — cermin
// lp-customer-edit untuk LP. Hanya alamat + poskod (lajur yang wujud pada
// `orders`); nama/telefon pelanggan ikut `profiles`, tidak diedit di sini.
// PATCH → /api/admin/orders/[id]/customer (laluan baharu; PATCH status tidak disentuh).

interface Props {
  orderId: string
  deliveryAddress: string | null
  postcode: string | null
  deliveryMethod: string | null
  deliverySlot: string | null
  pickupDate: string | null
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'

export function DeliveryAddressEdit({ orderId, deliveryAddress, postcode, deliveryMethod, deliverySlot, pickupDate }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ address: deliveryAddress ?? '', postcode: postcode ?? '' })

  const isPickup = deliveryMethod === 'pickup'
  const postcodeMissing = !isPickup && !/^\d{5}$/.test((postcode ?? '').trim())

  function cancel() {
    setEditing(false)
    setForm({ address: deliveryAddress ?? '', postcode: postcode ?? '' })
  }

  async function save() {
    const address = form.address.trim()
    const pc = form.postcode.trim()
    if (!isPickup && !address) { toast.error('Alamat diperlukan'); return }
    if (!isPickup && !/^\d{5}$/.test(pc)) { toast.error('Poskod diperlukan (5 digit)'); return }
    if (isPickup && pc && !/^\d{5}$/.test(pc)) { toast.error('Poskod mesti 5 digit'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/customer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_address: address || null, postcode: pc || null }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        toast.error(j?.error ?? 'Gagal simpan')
      } else {
        toast.success('Alamat penghantaran dikemas kini')
        setEditing(false)
        router.refresh()
      }
    } catch {
      toast.error('Gagal simpan')
    } finally {
      setSaving(false)
    }
  }

  const title = isPickup ? 'Ambil Sendiri (Pickup)' : 'Penghantaran'

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Edit {title}</h2>
          <button type="button" onClick={cancel} aria-label="Batal" className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">
              Alamat {!isPickup && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">
              Poskod {!isPickup && <span className="text-red-500">*</span>}
            </label>
            <input
              value={form.postcode}
              inputMode="numeric"
              maxLength={5}
              onChange={e => setForm(f => ({ ...f, postcode: e.target.value.replace(/\D/g, '') }))}
              placeholder="cth: 47180"
              className={inputCls}
            />
            <p className="text-[11px] text-gray-400 mt-1">Perlu untuk tentukan zon kurier (LK / Pos).</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <Check className="h-4 w-4" />{saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {isPickup && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">PICKUP</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg"
        >
          <Pencil className="h-3 w-3" />Edit
        </button>
      </div>
      {isPickup && pickupDate && (
        <p className="flex items-center gap-1.5 text-sm text-brand-fresh-700 font-semibold mb-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0" />Tarikh ambil: {new Date(pickupDate).toLocaleDateString('en-MY')}
        </p>
      )}
      {deliverySlot && (
        <p className="flex items-center gap-1.5 text-sm text-brand-fresh-700 font-semibold mb-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />{deliverySlot}
        </p>
      )}
      {deliveryAddress ? (
        <p className="flex items-start gap-1.5 text-sm text-gray-700 whitespace-pre-line">
          <MapPin className="h-3.5 w-3.5 text-gray-400 mt-1 shrink-0" />
          <span>{deliveryAddress}</span>
        </p>
      ) : (
        !isPickup && <p className="text-sm text-gray-400 italic">Tiada alamat</p>
      )}
      {postcode && (
        <p className="text-sm text-gray-500 mt-1">Poskod: <span className="font-semibold text-gray-800">{postcode}</span></p>
      )}
      {postcodeMissing && (
        <div className="flex items-start gap-2 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-amber-700 font-medium">
            Tiada poskod — zon kurier tak dapat ditentukan (jatuh &laquo;Lain-lain&raquo;). Klik <b>Edit</b> untuk tambah.
          </span>
        </div>
      )}
    </div>
  )
}
