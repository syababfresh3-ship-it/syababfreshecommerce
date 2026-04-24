'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2, Plus } from 'lucide-react'

interface PromoCode {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_order: number
  max_uses: number | null
  uses_count: number
  active: boolean
  expires_at: string | null
  created_at: string
}

export function PromoManager({ promos }: { promos: PromoCode[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    min_order: '',
    max_uses: '',
    expires_at: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim() || !form.value) return
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('promo_codes').insert({
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      min_order: form.min_order ? Number(form.min_order) : 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
    })

    if (error) {
      toast.error(error.code === '23505' ? 'Kod sudah wujud' : 'Gagal buat kod')
    } else {
      toast.success('Kod promosi dicipta')
      setShowForm(false)
      setForm({ code: '', type: 'percentage', value: '', min_order: '', max_uses: '', expires_at: '' })
      router.refresh()
    }
    setLoading(false)
  }

  async function toggleActive(promo: PromoCode) {
    const supabase = createClient()
    await supabase.from('promo_codes').update({ active: !promo.active }).eq('id', promo.id)
    toast.success(promo.active ? 'Kod dinyahaktifkan' : 'Kod diaktifkan')
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Padam kod ini?')) return
    const supabase = createClient()
    await supabase.from('promo_codes').delete().eq('id', id)
    toast.success('Kod dipadam')
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Kod Promosi</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-brand-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-red-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Kod Baru
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
          <h2 className="font-semibold text-gray-900 mb-4">Kod Baru</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kod Promosi *</label>
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                placeholder="SYABAB10"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jenis Diskaun *</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="percentage">Peratus (%)</option>
                <option value="fixed">Tetap (RM)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Nilai {form.type === 'percentage' ? '(%)' : '(RM)'} *
              </label>
              <input
                name="value"
                type="number"
                min="0.01"
                step="0.01"
                value={form.value}
                onChange={handleChange}
                required
                placeholder={form.type === 'percentage' ? '10' : '5.00'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min. Pesanan (RM)</label>
              <input
                name="min_order"
                type="number"
                min="0"
                step="0.01"
                value={form.min_order}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Had Penggunaan (kosong = tiada had)</label>
              <input
                name="max_uses"
                type="number"
                min="1"
                value={form.max_uses}
                onChange={handleChange}
                placeholder="Tiada had"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tamat Tempoh (pilihan)</label>
              <input
                name="expires_at"
                type="datetime-local"
                value={form.expires_at}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-brand-red-600 text-white rounded-lg hover:bg-brand-red-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Simpan
            </button>
          </div>
        </form>
      )}

      {/* Promo list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diskaun</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Min. Order</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Guna</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tamat</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {promos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-400">Tiada kod promosi</td>
              </tr>
            ) : (
              promos.map((promo) => (
                <tr key={promo.id} className={`hover:bg-gray-50 transition-colors ${!promo.active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-mono font-bold text-gray-900">{promo.code}</td>
                  <td className="px-5 py-3 text-gray-700">
                    {promo.type === 'percentage'
                      ? `${promo.value}% diskaun`
                      : `RM${Number(promo.value).toFixed(2)} off`}
                  </td>
                  <td className="px-5 py-3 text-center text-gray-500">
                    {Number(promo.min_order) > 0 ? `RM${Number(promo.min_order).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-center text-gray-500">
                    {promo.uses_count}{promo.max_uses ? ` / ${promo.max_uses}` : ''}
                  </td>
                  <td className="px-5 py-3 text-center text-gray-500 text-xs">
                    {promo.expires_at
                      ? new Date(promo.expires_at).toLocaleDateString('ms-MY')
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => toggleActive(promo)}
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        promo.active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {promo.active ? 'Aktif' : 'Tidak Aktif'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
