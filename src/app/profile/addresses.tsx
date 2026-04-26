'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { MapPin, Plus, Trash2, Star, Loader2, Pencil } from 'lucide-react'
import type { Address } from '@/types'

export function AddressList({ addresses, userId }: { addresses: Address[]; userId: string }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: 'Rumah',
    recipient_name: '',
    recipient_phone: '',
    full_address: '',
    city: '',
    postcode: '',
    state: '',
  })
  const [editForm, setEditForm] = useState({ ...form })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function startEdit(addr: Address) {
    setEditingId(addr.id)
    setEditForm({
      label: addr.label ?? 'Rumah',
      recipient_name: addr.recipient_name ?? '',
      recipient_phone: addr.recipient_phone ?? '',
      full_address: addr.full_address ?? '',
      city: addr.city ?? '',
      postcode: addr.postcode ?? '',
      state: addr.state ?? '',
    })
  }

  async function handleEditSubmit(e: React.FormEvent, id: string) {
    e.preventDefault()
    if (!editForm.full_address.trim()) { toast.error('Alamat penuh wajib diisi'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('addresses').update({
      label: editForm.label,
      recipient_name: editForm.recipient_name || null,
      recipient_phone: editForm.recipient_phone || null,
      full_address: editForm.full_address,
      city: editForm.city || null,
      postcode: editForm.postcode || null,
      state: editForm.state || null,
    }).eq('id', id)

    if (error) {
      toast.error('Gagal kemaskini alamat')
    } else {
      toast.success('Alamat dikemaskini')
      setEditingId(null)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_address.trim()) {
      toast.error('Alamat penuh wajib diisi')
      return
    }
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('addresses').insert({
      user_id: userId,
      label: form.label,
      recipient_name: form.recipient_name || null,
      recipient_phone: form.recipient_phone || null,
      full_address: form.full_address,
      city: form.city || null,
      postcode: form.postcode || null,
      state: form.state || null,
      is_default: addresses.length === 0,
    })

    if (error) {
      toast.error('Gagal simpan alamat')
    } else {
      toast.success('Alamat ditambah')
      setShowForm(false)
      setForm({ label: 'Rumah', recipient_name: '', recipient_phone: '', full_address: '', city: '', postcode: '', state: '' })
      router.refresh()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Padam alamat ini?')) return
    const supabase = createClient()
    await supabase.from('addresses').delete().eq('id', id)
    toast.success('Alamat dipadam')
    router.refresh()
  }

  async function handleSetDefault(id: string) {
    const supabase = createClient()
    // Set new default first — if second call fails, at least one address is default
    await supabase.from('addresses').update({ is_default: true }).eq('id', id)
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId).neq('id', id)
    toast.success('Alamat utama dikemaskini')
    router.refresh()
  }

  const malaysiaStates = [
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
    'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
    'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur',
    'W.P. Labuan', 'W.P. Putrajaya',
  ]

  return (
    // account page final polish: addresses card
    <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-fresh-50 flex items-center justify-center">
            <MapPin className="h-3.5 w-3.5 text-brand-fresh-500" />
          </div>
          <h2 className="font-bold text-gray-900 text-sm">Alamat Penghantaran</h2>
        </div>
        {/* account page v3 conversion polish: only show top-right Tambah when addresses
            already exist — avoids double-CTA conflict with the big empty-state button */}
        {!showForm && addresses.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-white font-bold bg-brand-fresh-500 px-3 py-1.5 rounded-xl shadow-[0_2px_8px_rgba(34,197,94,0.25)] active:scale-95 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah
          </button>
        )}
      </div>

      {/* account page final polish: empty state with icon illustration */}
      {addresses.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-7 gap-1.5">
          {/* layered icon: outer ring + inner tinted square + icon */}
          <div className="relative mb-2">
            <div className="absolute inset-0 rounded-2xl bg-brand-fresh-100/50 scale-[1.25] blur-sm" />
            <div className="relative w-14 h-14 rounded-2xl bg-brand-fresh-50 border border-brand-fresh-100 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-brand-fresh-400" />
            </div>
          </div>
          <p className="text-sm font-bold text-gray-700">Belum ada alamat</p>
          <p className="text-xs text-gray-400 text-center leading-relaxed px-8">
            Tambah alamat untuk penghantaran yang lebih cepat dan mudah
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 flex items-center gap-1.5 text-xs font-bold text-white bg-brand-fresh-500 px-5 py-2.5 rounded-xl shadow-[0_3px_12px_rgba(34,197,94,0.32)] active:scale-[0.97] transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Alamat
          </button>
        </div>
      )}

      <div className="space-y-2 mb-3">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className={`rounded-xl transition-all ${
              editingId === addr.id
                ? 'border border-brand-fresh-200 bg-brand-fresh-50/40 p-3.5'
                : addr.is_default
                  ? 'bg-brand-fresh-50/70 shadow-[-3px_0_0_0_rgba(34,197,94,0.55),0_2px_10px_rgba(34,197,94,0.08)] p-3.5'
                  : 'bg-white shadow-[0_1px_6px_rgba(0,0,0,0.06)] p-3.5'
            }`}
          >
            {editingId === addr.id ? (
              <form onSubmit={(e) => handleEditSubmit(e, addr.id)} className="space-y-2.5">
                <p className="text-xs font-bold text-gray-700 mb-2">Edit Alamat</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Label</label>
                    <select name="label" value={editForm.label} onChange={handleEditChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-fresh-400">
                      {['Rumah', 'Pejabat', 'Lain-lain'].map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Nama Penerima</label>
                    <input name="recipient_name" value={editForm.recipient_name} onChange={handleEditChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-fresh-400" placeholder="Nama" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">No. Telefon Penerima</label>
                  <input name="recipient_phone" type="tel" value={editForm.recipient_phone} onChange={handleEditChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-fresh-400" placeholder="011-1234 5678" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Alamat Penuh *</label>
                  <textarea name="full_address" value={editForm.full_address} onChange={handleEditChange} rows={2} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-fresh-400" placeholder="No. rumah, jalan, kawasan..." />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Poskod</label>
                    <input name="postcode" value={editForm.postcode} onChange={handleEditChange} maxLength={5}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-fresh-400" placeholder="47500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Bandar</label>
                    <input name="city" value={editForm.city} onChange={handleEditChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-fresh-400" placeholder="Subang Jaya" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Negeri</label>
                    <select name="state" value={editForm.state} onChange={handleEditChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-fresh-400">
                      <option value="">—</option>
                      {malaysiaStates.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setEditingId(null)}
                    className="flex-1 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Batal
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-brand-fresh-500 text-white rounded-lg hover:bg-brand-fresh-600 disabled:opacity-50 transition-colors">
                    {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                    Simpan
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-gray-700">{addr.label}</span>
                    {addr.is_default && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-brand-fresh-600 font-semibold bg-brand-fresh-100 px-1.5 py-0.5 rounded-full">
                        <Star className="h-2.5 w-2.5 fill-current" /> Utama
                      </span>
                    )}
                  </div>
                  {addr.recipient_name && (
                    <p className="text-xs text-gray-600">{addr.recipient_name} · {addr.recipient_phone}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-0.5">{addr.full_address}</p>
                  {(addr.city || addr.postcode || addr.state) && (
                    <p className="text-xs text-gray-400 mt-0.5">{[addr.postcode, addr.city, addr.state].filter(Boolean).join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {!addr.is_default && (
                    <button onClick={() => handleSetDefault(addr.id)}
                      className="text-[10px] text-brand-fresh-600 font-semibold bg-brand-fresh-50 border border-brand-fresh-100 px-2 py-0.5 rounded-full hover:bg-brand-fresh-100 transition-colors">
                      Jadikan utama
                    </button>
                  )}
                  <button onClick={() => startEdit(addr)}
                    className="p-1.5 text-gray-300 hover:text-brand-fresh-500 transition-colors rounded-lg hover:bg-brand-fresh-50">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(addr.id)}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <select
                name="label"
                value={form.label}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
              >
                {['Rumah', 'Pejabat', 'Lain-lain'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nama Penerima</label>
              <input
                name="recipient_name"
                value={form.recipient_name}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
                placeholder="Nama"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">No. Telefon Penerima</label>
            <input
              name="recipient_phone"
              type="tel"
              value={form.recipient_phone}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
              placeholder="011-1234 5678"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Alamat Penuh *</label>
            <textarea
              name="full_address"
              value={form.full_address}
              onChange={handleChange}
              rows={2}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
              placeholder="No. rumah, jalan, kawasan..."
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Poskod</label>
              <input
                name="postcode"
                value={form.postcode}
                onChange={handleChange}
                maxLength={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
                placeholder="47500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bandar</label>
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
                placeholder="Subang Jaya"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Negeri</label>
              <select
                name="state"
                value={form.state}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
              >
                <option value="">—</option>
                {malaysiaStates.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-brand-fresh-500 text-white rounded-lg hover:bg-brand-fresh-600 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Simpan
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
