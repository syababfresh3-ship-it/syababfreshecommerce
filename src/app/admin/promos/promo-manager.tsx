'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2, Plus, Tag, Copy, TrendingUp, Clock, X } from 'lucide-react'

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

function expiryStatus(expires_at: string | null) {
  if (!expires_at) return null
  const days = Math.ceil((new Date(expires_at).getTime() - Date.now()) / 86400000)
  if (days < 0)  return { label: 'Tamat',       cls: 'text-red-600 bg-red-50 border-red-200' }
  if (days <= 3) return { label: `${days}h lagi`, cls: 'text-orange-600 bg-orange-50 border-orange-200' }
  if (days <= 7) return { label: `${days}h lagi`, cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' }
  return { label: new Date(expires_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' }), cls: 'text-gray-500 bg-gray-50 border-gray-200' }
}

export function PromoManager({ promos }: { promos: PromoCode[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    code: '', type: 'percentage' as 'percentage' | 'fixed',
    value: '', min_order: '', max_uses: '', expires_at: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const val = e.target.name === 'code' ? e.target.value.toUpperCase() : e.target.value
    setForm(prev => ({ ...prev, [e.target.name]: val }))
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

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    toast.success(`"${code}" disalin`)
  }

  const active   = promos.filter(p => p.active)
  const inactive = promos.filter(p => !p.active)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kod Promosi</h1>
          <p className="text-sm text-gray-400 mt-0.5">{active.length} aktif · {inactive.length} tidak aktif</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Kod Baru
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-red-100 p-1.5 rounded-lg">
                <Tag className="h-4 w-4 text-red-600" />
              </div>
              <h2 className="font-bold text-gray-900">Kod Promosi Baru</h2>
            </div>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Code preview */}
            {form.code && (
              <div className="bg-gray-900 rounded-xl px-4 py-3 text-center">
                <span className="font-mono font-black text-white text-xl tracking-widest">{form.code}</span>
                {form.value && (
                  <p className="text-gray-400 text-xs mt-1">
                    {form.type === 'percentage' ? `${form.value}% diskaun` : `RM${Number(form.value).toFixed(2)} off`}
                    {form.min_order ? ` · min RM${Number(form.min_order).toFixed(2)}` : ''}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Kod Promosi *</label>
                <input name="code" value={form.code} onChange={handleChange} required
                  placeholder="SYABAB10"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Jenis Diskaun *</label>
                <select name="type" value={form.type} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300">
                  <option value="percentage">Peratus (%)</option>
                  <option value="fixed">Tetap (RM)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Nilai {form.type === 'percentage' ? '(%)' : '(RM)'} *
                </label>
                <input name="value" type="number" min="0.01" step="0.01" value={form.value} onChange={handleChange} required
                  placeholder={form.type === 'percentage' ? '10' : '5.00'}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Min. Pesanan (RM)</label>
                <input name="min_order" type="number" min="0" step="0.01" value={form.min_order} onChange={handleChange}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Had Penggunaan</label>
                <input name="max_uses" type="number" min="1" value={form.max_uses} onChange={handleChange}
                  placeholder="Tiada had"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tamat Tempoh</label>
                <input name="expires_at" type="datetime-local" value={form.expires_at} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Cipta Kod
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Promo cards */}
      {promos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-14 text-center text-gray-400">
          Tiada kod promosi lagi.
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map(promo => {
            const usagePct = promo.max_uses ? Math.min(100, (promo.uses_count / promo.max_uses) * 100) : 0
            const expiry = expiryStatus(promo.expires_at)
            const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date()
            return (
              <div key={promo.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${!promo.active || isExpired ? 'opacity-60 border-gray-100' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-center gap-4 p-4">
                  {/* Code */}
                  <div className="bg-gray-900 rounded-xl px-4 py-2.5 shrink-0 text-center min-w-[120px]">
                    <span className="font-mono font-black text-white tracking-widest text-sm">{promo.code}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900 text-sm">
                        {promo.type === 'percentage' ? `${promo.value}% Diskaun` : `RM${Number(promo.value).toFixed(2)} Off`}
                      </span>
                      {Number(promo.min_order) > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          min RM{Number(promo.min_order).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {/* Usage bar */}
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500">
                        {promo.uses_count}{promo.max_uses ? ` / ${promo.max_uses} guna` : ' guna'}
                      </span>
                      {promo.max_uses && (
                        <div className="flex-1 max-w-[80px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${usagePct >= 90 ? 'bg-red-400' : usagePct >= 60 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expiry */}
                  {expiry && (
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${expiry.cls} shrink-0`}>
                      <Clock className="h-3 w-3" />
                      {expiry.label}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => copyCode(promo.code)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="Salin kod">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => toggleActive(promo)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        promo.active
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}>
                      {promo.active ? 'Aktif' : 'Tidak Aktif'}
                    </button>
                    <button onClick={() => handleDelete(promo.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
