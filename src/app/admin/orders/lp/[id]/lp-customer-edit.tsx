'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Phone, Mail, MapPin, Pencil, X, Check, AlertTriangle } from 'lucide-react'

interface Props {
  orderId: string
  name: string
  phone: string
  email: string | null
  address: string | null
  postcode: string | null
  deliveryMethod: string | null
  pickupDate: string | null
}

export function LpCustomerEdit({ orderId, name, phone, email, address, postcode, deliveryMethod, pickupDate }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: name ?? '',
    phone: phone ?? '',
    address: address ?? '',
    postcode: postcode ?? '',
  })

  const isPickup = deliveryMethod === 'pickup'
  const postcodeMissing = !isPickup && !/^\d{5}$/.test((postcode ?? '').trim())

  async function save() {
    if (!form.name.trim()) { toast.error('Nama diperlukan'); return }
    if (!form.phone.trim()) { toast.error('No. telefon diperlukan'); return }
    if (!isPickup && !/^\d{5}$/.test(form.postcode.trim())) { toast.error('Poskod diperlukan (5 digit)'); return }
    setSaving(true)
    const res = await fetch('/api/admin/landing-pages/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: orderId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        postcode: form.postcode.trim() || null,
      }),
    })
    if (!res.ok) toast.error('Gagal simpan')
    else { toast.success('Customer details dikemaskini'); setEditing(false); router.refresh() }
    setSaving(false)
  }

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Edit Customer</h2>
          <button onClick={() => { setEditing(false); setForm({ name: name ?? '', phone: phone ?? '', address: address ?? '', postcode: postcode ?? '' }) }}
            className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Nama</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">No. Telefon</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          {!isPickup && (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Alamat</label>
                <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">
                  Poskod <span className="text-red-500">*</span>
                </label>
                <input value={form.postcode} inputMode="numeric" maxLength={5}
                  onChange={e => setForm(f => ({ ...f, postcode: e.target.value.replace(/\D/g, '') }))}
                  placeholder="cth: 47180"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <p className="text-[11px] text-gray-400 mt-1">Perlu untuk tentukan zon kurier (LK / Pos).</p>
              </div>
            </>
          )}
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors">
            <Check className="h-4 w-4" />{saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Customer Details</h2>
        <button onClick={() => setEditing(true)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg">
          <Pencil className="h-3 w-3" />Edit
        </button>
      </div>
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium text-gray-400 w-12">Name</span>
          <span className="font-semibold text-gray-900">{name}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <a href={`tel:${phone}`} className="text-blue-600 hover:underline">{phone}</a>
        </div>
        {email && (
          <div className="flex items-center gap-2.5">
            <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <a href={`mailto:${email}`} className="text-blue-600 hover:underline break-all">{email}</a>
          </div>
        )}
        {address && (
          <div className="flex items-start gap-2.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
            <span className="text-gray-600 leading-relaxed text-xs">{address}{postcode ? `, ${postcode}` : ''}</span>
          </div>
        )}
        {isPickup && pickupDate && (
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-gray-400 w-12">Pickup</span>
            <span className="font-semibold text-purple-700">📅 {new Date(pickupDate).toLocaleDateString('en-MY')}</span>
          </div>
        )}
        {postcodeMissing && (
          <div className="flex items-start gap-2 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <span className="text-[11px] text-amber-700 font-medium">Tiada poskod — zon kurier tak dapat ditentukan (jatuh &laquo;Lain-lain&raquo;). Klik <b>Edit</b> untuk tambah.</span>
          </div>
        )}
      </div>
    </div>
  )
}
