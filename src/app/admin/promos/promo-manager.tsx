'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Loader2, Plus, Tag, Copy, TrendingUp, Clock, X, Pencil, Check, Boxes, CalendarClock, UserCheck } from 'lucide-react'
import { promoLabel, promoScopeCount, isMissingColumnError, type PromoType } from '@/lib/promo-rules'

interface PromoCode {
  id: string
  code: string
  type: PromoType
  value: number
  min_order: number
  max_uses: number | null
  uses_count: number
  active: boolean
  expires_at: string | null
  created_at: string
  // Sprint 3H (migration 131) — mungkin belum wujud dalam DB.
  starts_at?: string | null
  scope_product_ids?: string[] | null
  scope_category_ids?: string[] | null
  per_user_limit?: number | null
}

interface ScopeOption { id: string; name: string }

const MIGRATION_HINT = 'Jalankan migration 131 dulu'

function expiryStatus(expires_at: string | null) {
  if (!expires_at) return null
  const days = Math.ceil((new Date(expires_at).getTime() - Date.now()) / 86400000)
  if (days < 0)  return { label: 'Tamat',       cls: 'text-red-600 bg-red-50 border-red-200' }
  if (days <= 3) return { label: `${days}h lagi`, cls: 'text-orange-600 bg-orange-50 border-orange-200' }
  if (days <= 7) return { label: `${days}h lagi`, cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' }
  return { label: new Date(expires_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' }), cls: 'text-gray-500 bg-gray-50 border-gray-200' }
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })

// Baris ringkasan: label diskaun · skop · tetingkap masa · had per pelanggan.
function summaryLine(promo: PromoCode): string {
  const bits: string[] = [promoLabel(promo)]
  const scope = promoScopeCount(promo)
  bits.push(scope === 0 ? 'Semua produk' : `${scope} skop produk/kategori`)
  if (promo.starts_at && promo.expires_at) bits.push(`${shortDate(promo.starts_at)} – ${shortDate(promo.expires_at)}`)
  else if (promo.starts_at) bits.push(`Mula ${shortDate(promo.starts_at)}`)
  else if (promo.expires_at) bits.push(`Hingga ${shortDate(promo.expires_at)}`)
  if (promo.per_user_limit != null) bits.push(`${promo.per_user_limit}× / pelanggan`)
  return bits.join(' · ')
}

// Pemilih skop — senarai checkbox ringkas (monokrom, boleh skrol).
function ScopePicker({ label, options, selected, onToggle }: {
  label: string
  options: ScopeOption[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (options.length === 0) return null
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">
        {label} <span className="font-normal text-gray-400">({selected.length || 'semua'})</span>
      </label>
      <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
        {options.map(o => (
          <label key={o.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)}
              className="h-3.5 w-3.5 accent-gray-800" />
            <span className="truncate">{o.name}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export function PromoManager({ promos }: { promos: PromoCode[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const emptyForm = {
    code: '', type: 'percentage' as PromoType,
    value: '', min_order: '', max_uses: '', expires_at: '',
    // Sprint 3H
    starts_at: '', per_user_limit: '',
    scope_product_ids: [] as string[], scope_category_ids: [] as string[],
  }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    type: 'percentage' as PromoType,
    value: '', min_order: '', max_uses: '', expires_at: '',
    starts_at: '', per_user_limit: '',
    scope_product_ids: [] as string[], scope_category_ids: [] as string[],
  })
  const [editLoading, setEditLoading] = useState(false)
  // Pilihan skop — dibaca dengan browser client (RLS: produk/kategori aktif boleh dibaca).
  const [productOpts, setProductOpts] = useState<ScopeOption[]>([])
  const [categoryOpts, setCategoryOpts] = useState<ScopeOption[]>([])

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('products').select('id, name').eq('is_active', true).order('name').limit(300),
      supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
    ]).then(([p, c]) => {
      setProductOpts((p.data ?? []) as ScopeOption[])
      setCategoryOpts((c.data ?? []) as ScopeOption[])
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const val = e.target.name === 'code' ? e.target.value.toUpperCase() : e.target.value
    setForm(prev => ({ ...prev, [e.target.name]: val }))
  }

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id]

  function startEdit(promo: PromoCode) {
    setEditingId(promo.id)
    setEditForm({
      type: promo.type,
      value: String(promo.value),
      min_order: promo.min_order ? String(promo.min_order) : '',
      max_uses: promo.max_uses ? String(promo.max_uses) : '',
      expires_at: promo.expires_at ? promo.expires_at.slice(0, 16) : '',
      starts_at: promo.starts_at ? promo.starts_at.slice(0, 16) : '',
      per_user_limit: promo.per_user_limit != null ? String(promo.per_user_limit) : '',
      scope_product_ids: promo.scope_product_ids ?? [],
      scope_category_ids: promo.scope_category_ids ?? [],
    })
  }

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Medan Sprint 3H hanya dihantar bila digunakan — kod lama tetap boleh disimpan
  // walaupun migration 131 belum dijalankan.
  function advancedFields(f: { starts_at: string; per_user_limit: string; scope_product_ids: string[]; scope_category_ids: string[]; type: PromoType }) {
    const out: Record<string, unknown> = {}
    if (f.starts_at) out.starts_at = f.starts_at
    if (f.per_user_limit) out.per_user_limit = Number(f.per_user_limit)
    if (f.scope_product_ids.length > 0) out.scope_product_ids = f.scope_product_ids
    if (f.scope_category_ids.length > 0) out.scope_category_ids = f.scope_category_ids
    return out
  }

  // Kolum/constraint 131 belum ada → beritahu admin dengan jelas, bukan ralat mentah.
  function promoWriteError(error: { code?: string | null; message?: string } | null, fallback: string) {
    if (!error) return
    if (isMissingColumnError(error)) { toast.error(MIGRATION_HINT); return }
    if (error.code === '23514') { toast.error(`${MIGRATION_HINT} (jenis "Hantar percuma" belum dibenarkan)`); return }
    if (error.code === '23505') { toast.error('Kod sudah wujud'); return }
    toast.error(fallback)
  }

  async function handleUpdate(id: string) {
    setEditLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('promo_codes').update({
      type: editForm.type,
      value: Number(editForm.value),
      min_order: editForm.min_order ? Number(editForm.min_order) : 0,
      max_uses: editForm.max_uses ? Number(editForm.max_uses) : null,
      expires_at: editForm.expires_at || null,
      ...advancedFields(editForm),
    }).eq('id', id)
    if (error) {
      promoWriteError(error, 'Failed update kod')
    } else {
      toast.success('Kod diupdate')
      setEditingId(null)
      router.refresh()
    }
    setEditLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code.trim()) return
    if (form.type !== 'free_shipping' && !form.value) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('promo_codes').insert({
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: form.type === 'free_shipping' ? 0 : Number(form.value),
      min_order: form.min_order ? Number(form.min_order) : 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at || null,
      ...advancedFields(form),
    })
    if (error) {
      promoWriteError(error, 'Failed buat kod')
    } else {
      toast.success('Kod promotions dicipta')
      setShowForm(false)
      setForm(emptyForm)
      router.refresh()
    }
    setLoading(false)
  }

  async function toggleActive(promo: PromoCode) {
    const supabase = createClient()
    await supabase.from('promo_codes').update({ active: !promo.active }).eq('id', promo.id)
    toast.success(promo.active ? 'Kod dinyahactivekan' : 'Kod diactivekan')
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete kod ini?')) return
    const supabase = createClient()
    await supabase.from('promo_codes').delete().eq('id', id)
    toast.success('Kod didelete')
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
          <h1 className="text-xl font-bold text-gray-900">Kod Promotions</h1>
          <p className="text-sm text-gray-400 mt-0.5">{active.length} active · {inactive.length} inactive</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Kod New
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
              <h2 className="font-bold text-gray-900">Kod Promotions New</h2>
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
                {(form.value || form.type === 'free_shipping') && (
                  <p className="text-gray-400 text-xs mt-1">
                    {form.type === 'free_shipping'
                      ? 'Hantar percuma'
                      : form.type === 'percentage' ? `${form.value}% diskaun` : `RM${Number(form.value).toFixed(2)} off`}
                    {form.min_order ? ` · min RM${Number(form.min_order).toFixed(2)}` : ''}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Kod Promotions *</label>
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
                  <option value="free_shipping">Hantar percuma</option>
                </select>
              </div>
              {form.type !== 'free_shipping' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Nilai {form.type === 'percentage' ? '(%)' : '(RM)'} *
                  </label>
                  <input name="value" type="number" min="0.01" step="0.01" value={form.value} onChange={handleChange} required
                    placeholder={form.type === 'percentage' ? '10' : '5.00'}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Min. Orders (RM)</label>
                <input name="min_order" type="number" min="0" step="0.01" value={form.min_order} onChange={handleChange}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Had Useran</label>
                <input name="max_uses" type="number" min="1" value={form.max_uses} onChange={handleChange}
                  placeholder="No had"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mula Period</label>
                <input name="starts_at" type="datetime-local" value={form.starts_at} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tamat Period</label>
                <input name="expires_at" type="datetime-local" value={form.expires_at} onChange={handleChange}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Had Per Pelanggan</label>
                <input name="per_user_limit" type="number" min="1" value={form.per_user_limit} onChange={handleChange}
                  placeholder="Ikut tetapan lama"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
            </div>

            {/* Skop — kosong = semua produk */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ScopePicker label="Hanya produk ini" options={productOpts}
                selected={form.scope_product_ids}
                onToggle={id => setForm(p => ({ ...p, scope_product_ids: toggleId(p.scope_product_ids, id) }))} />
              <ScopePicker label="Hanya kategori ini" options={categoryOpts}
                selected={form.scope_category_ids}
                onToggle={id => setForm(p => ({ ...p, scope_category_ids: toggleId(p.scope_category_ids, id) }))} />
            </div>
            <p className="text-[11px] text-gray-400">
              Skop kosong = semua produk. Min. pesanan tetap dikira atas subtotal penuh; diskaun dikira atas item yang layak sahaja.
            </p>

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
          No kod promotions lagi.
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map(promo => {
            const usagePct = promo.max_uses ? Math.min(100, (promo.uses_count / promo.max_uses) * 100) : 0
            const expiry = expiryStatus(promo.expires_at)
            const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date()
            const notStarted = !!promo.starts_at && new Date(promo.starts_at) > new Date()
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
                        {promo.type === 'free_shipping'
                          ? 'Hantar Percuma'
                          : promo.type === 'percentage' ? `${promo.value}% Diskaun` : `RM${Number(promo.value).toFixed(2)} Off`}
                      </span>
                      {Number(promo.min_order) > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          min RM{Number(promo.min_order).toFixed(2)}
                        </span>
                      )}
                      {notStarted && (
                        <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                          Dijadual
                        </span>
                      )}
                    </div>
                    {/* Ringkasan Sprint 3H: label · skop · tetingkap · had/pelanggan */}
                    <p className="text-[11px] text-gray-400 truncate mb-1">{summaryLine(promo)}</p>
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
                    <button onClick={() => editingId === promo.id ? setEditingId(null) : startEdit(promo)}
                      className={`p-1.5 rounded-lg transition-colors ${editingId === promo.id ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => toggleActive(promo)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        promo.active
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}>
                      {promo.active ? 'Active' : 'Inactive'}
                    </button>
                    <button onClick={() => handleDelete(promo.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === promo.id && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Jenis Diskaun</label>
                        <select name="type" value={editForm.type} onChange={handleEditChange}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="percentage">Peratus (%)</option>
                          <option value="fixed">Tetap (RM)</option>
                          <option value="free_shipping">Hantar percuma</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          Nilai {editForm.type === 'percentage' ? '(%)' : '(RM)'}
                        </label>
                        <input name="value" type="number" min="0.01" step="0.01" value={editForm.value} onChange={handleEditChange}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Min. Orders (RM)</label>
                        <input name="min_order" type="number" min="0" step="0.01" value={editForm.min_order} onChange={handleEditChange}
                          placeholder="0.00"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Had Useran</label>
                        <input name="max_uses" type="number" min="1" value={editForm.max_uses} onChange={handleEditChange}
                          placeholder="No had"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          <CalendarClock className="h-3 w-3 inline mr-1 -mt-0.5" />Mula Period
                        </label>
                        <input name="starts_at" type="datetime-local" value={editForm.starts_at} onChange={handleEditChange}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Tamat Period</label>
                        <input name="expires_at" type="datetime-local" value={editForm.expires_at} onChange={handleEditChange}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          <UserCheck className="h-3 w-3 inline mr-1 -mt-0.5" />Had Per Pelanggan
                        </label>
                        <input name="per_user_limit" type="number" min="1" value={editForm.per_user_limit} onChange={handleEditChange}
                          placeholder="Ikut tetapan lama"
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      </div>
                    </div>

                    {/* Skop — kosong = semua produk */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <ScopePicker label="Hanya produk ini" options={productOpts}
                        selected={editForm.scope_product_ids}
                        onToggle={id => setEditForm(p => ({ ...p, scope_product_ids: toggleId(p.scope_product_ids, id) }))} />
                      <ScopePicker label="Hanya kategori ini" options={categoryOpts}
                        selected={editForm.scope_category_ids}
                        onToggle={id => setEditForm(p => ({ ...p, scope_category_ids: toggleId(p.scope_category_ids, id) }))} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                      <Boxes className="h-3 w-3 shrink-0" />
                      Skop kosong = semua produk.
                    </p>

                    <div className="flex items-end gap-2 mt-3 max-w-xs">
                      <button onClick={() => handleUpdate(promo.id)} disabled={editLoading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {editLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
