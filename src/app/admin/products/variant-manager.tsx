'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Save, GripVertical } from 'lucide-react'
import type { ProductVariant } from '@/types'

interface Props {
  productId: string
}

const EMPTY_FORM = { name: '', price: '', compare_price: '', stock: '0', sku: '' }

export function VariantManager({ productId }: Props) {
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, Partial<ProductVariant>>>({})

  async function load() {
    const res = await fetch(`/api/admin/products/${productId}/variants`)
    if (res.ok) setVariants(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [productId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.price) { toast.error('Name dan price diperlukan'); return }
    setAdding(true)
    const res = await fetch(`/api/admin/products/${productId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        price: parseFloat(form.price),
        compare_price: form.compare_price || null,
        stock: parseInt(form.stock) || 0,
        sku: form.sku || null,
        sort_order: variants.length,
      }),
    })
    if (!res.ok) { toast.error('Failed tambah variasi'); }
    else {
      toast.success(`Variasi "${form.name}" ditambah`)
      setForm(EMPTY_FORM)
      setShowAdd(false)
      load()
    }
    setAdding(false)
  }

  async function handleSave(variantId: string) {
    const changes = editing[variantId]
    if (!changes) return
    setSaving(variantId)
    const res = await fetch(`/api/admin/products/${productId}/variants/${variantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    if (!res.ok) toast.error('Failed save')
    else {
      toast.success('Disave')
      setEditing(prev => { const n = { ...prev }; delete n[variantId]; return n })
      load()
    }
    setSaving(null)
  }

  async function handleSaveAll() {
    const dirtyIds = Object.keys(editing)
    if (dirtyIds.length === 0) return
    setSaving('all')
    const results = await Promise.all(
      dirtyIds.map(id =>
        fetch(`/api/admin/products/${productId}/variants/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing[id]),
        })
      )
    )
    const failed = results.filter(r => !r.ok).length
    if (failed > 0) toast.error(`${failed} variasi failed disave`)
    else toast.success(`${dirtyIds.length} variasi disave`)
    setEditing({})
    load()
    setSaving(null)
  }

  async function handleDelete(v: ProductVariant) {
    if (!confirm(`Delete variasi "${v.name}"?`)) return
    const res = await fetch(`/api/admin/products/${productId}/variants/${v.id}`, { method: 'DELETE' })
    if (!res.ok) toast.error('Failed delete')
    else { toast.success('Didelete'); load() }
  }

  async function toggleActive(v: ProductVariant) {
    await fetch(`/api/admin/products/${productId}/variants/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !v.is_active }),
    })
    load()
  }

  function patchEdit(variantId: string, key: string, value: unknown) {
    setEditing(prev => ({
      ...prev,
      [variantId]: { ...(prev[variantId] ?? {}), [key]: value },
    }))
  }

  function getVal<K extends keyof ProductVariant>(v: ProductVariant, key: K): ProductVariant[K] {
    return (editing[v.id]?.[key] as ProductVariant[K]) ?? v[key]
  }

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Variasi Product</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {variants.length > 0 ? `${variants.length} variasi` : 'No variasi — product dijual pada price tetap'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(editing).length > 0 && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving === 'all'}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-gray-900 px-3 py-2 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving === 'all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save All ({Object.keys(editing).length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Variasi
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Variasi New</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="cth: 1kg, 3kg Gred A, 6 biji"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price (RM) *</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Price Asal (RM)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.compare_price}
                  onChange={e => setForm(p => ({ ...p, compare_price: e.target.value }))}
                  placeholder="–"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
                <input
                  type="number" min="0"
                  value={form.stock}
                  onChange={e => setForm(p => ({ ...p, stock: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {adding ? 'Menambah...' : 'Tambah'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
              className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Variant list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
        </div>
      ) : variants.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-xl">
          Belum ada variasi. Add variasi di atas untuk jual dalam pelbagai saiz/gred.
        </p>
      ) : (
        <div className="space-y-2">
          {variants.map(v => {
            const isSaving = saving === v.id
            const isDirty = !!editing[v.id]
            return (
              <div key={v.id} className={`bg-white border rounded-xl p-3 transition-all ${v.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'}`}>
                <div className="flex items-end gap-2">
                  <GripVertical className="h-4 w-4 text-gray-300 shrink-0 mb-1.5" />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-gray-400 mb-1">Name</p>
                    <input
                      value={String(getVal(v, 'name'))}
                      onChange={e => patchEdit(v.id, 'name', e.target.value)}
                      className="w-full text-sm font-semibold text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Price */}
                  <div className="shrink-0 w-24">
                    <p className="text-[10px] font-medium text-gray-400 mb-1">Price (RM)</p>
                    <input
                      type="number" step="0.01" min="0"
                      value={String(getVal(v, 'price'))}
                      onChange={e => patchEdit(v.id, 'price', e.target.value)}
                      className="w-full text-sm font-bold text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Compare price */}
                  <div className="shrink-0 w-24">
                    <p className="text-[10px] font-medium text-gray-400 mb-1">Price Asal</p>
                    <input
                      type="number" step="0.01" min="0"
                      value={String(getVal(v, 'compare_price') ?? '')}
                      onChange={e => patchEdit(v.id, 'compare_price', e.target.value || null)}
                      placeholder="–"
                      className="w-full text-sm text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Stock */}
                  <div className="shrink-0 w-16">
                    <p className="text-[10px] font-medium text-gray-400 mb-1">Stock</p>
                    <input
                      type="number" min="0"
                      value={String(getVal(v, 'stock'))}
                      onChange={e => patchEdit(v.id, 'stock', e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Active toggle */}
                  <button
                    type="button"
                    onClick={() => toggleActive(v)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold shrink-0 mb-0.5 transition-colors ${v.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                  >
                    {v.is_active ? 'Active' : 'Mati'}
                  </button>

                  {/* Save */}
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => handleSave(v.id)}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg disabled:opacity-50 hover:bg-gray-800 transition-colors shrink-0 mb-0.5"
                    >
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDelete(v)}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0 mb-0.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
