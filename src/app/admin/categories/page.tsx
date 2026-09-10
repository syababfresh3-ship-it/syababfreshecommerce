'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, GripVertical, Eye, EyeOff, Tag, Pencil, X, Check, PanelLeft } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  parent_id: string | null
  // Migration 125 — rail katalog. undefined = lajur belum wujud (migration belum jalan).
  show_in_rail?: boolean
  rail_order?: number
}

// Medan rail dalam borang. Simpan sebagai string supaya input kosong tak jadi NaN.
type RailForm = { show_in_rail: boolean; rail_order: string }
const railPayload = (f: RailForm) => ({ show_in_rail: f.show_in_rail, rail_order: Number.parseInt(f.rail_order, 10) || 0 })

// Migration 125 belum dijalankan → PostgREST tak kenal lajur (PGRST204 / 42703).
// Simpan tanpa medan rail supaya borang masih boleh guna; beritahu admin.
function isRailColumnMissing(err: { code?: string; message?: string } | null) {
  if (!err) return false
  return err.code === 'PGRST204' || err.code === '42703' || /show_in_rail|rail_order/.test(err.message ?? '')
}
const RAIL_MIGRATION_HINT = 'Tetapan rail belum aktif — jalankan migration 125_categories_rail.sql'

function autoSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', slug: '', description: '', parent_id: '', show_in_rail: true, rail_order: '0' })
  const [editForm, setEditForm] = useState({ name: '', slug: '', description: '', parent_id: '', show_in_rail: true, rail_order: '0' })
  const [dragId, setDragId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('categories').select('*').order('sort_order')
    setCategories(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    const base = {
      name: form.name.trim(),
      slug: form.slug || autoSlug(form.name),
      description: form.description || null,
      sort_order: categories.length,
      is_active: true,
      parent_id: form.parent_id || null,
    }
    let { error } = await supabase.from('categories').insert({ ...base, ...railPayload(form) })
    if (isRailColumnMissing(error)) {
      toast.info(RAIL_MIGRATION_HINT)
      ;({ error } = await supabase.from('categories').insert(base))
    }
    if (error) {
      toast.error(error.code === '23505' ? 'Slug sudah wujud' : 'Failed tambah')
    } else {
      toast.success('Category ditambah')
      setForm({ name: '', slug: '', description: '', parent_id: '', show_in_rail: true, rail_order: '0' })
      setShowForm(false)
      load()
    }
    setLoading(false)
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    setLoading(true)
    const base = {
      name: editForm.name.trim(),
      slug: editForm.slug || autoSlug(editForm.name),
      description: editForm.description || null,
      parent_id: editForm.parent_id || null,
    }
    let { error } = await supabase.from('categories').update({ ...base, ...railPayload(editForm) }).eq('id', id)
    if (isRailColumnMissing(error)) {
      toast.info(RAIL_MIGRATION_HINT)
      ;({ error } = await supabase.from('categories').update(base).eq('id', id))
    }
    if (error) toast.error('Failed update')
    else { toast.success('Diupdate'); setEditingId(null); load() }
    setLoading(false)
  }

  async function toggleActive(cat: Category) {
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    load()
  }

  // Papar/sorok chip rail katalog (produk kategori tersorok digabung ke induk / Lain-lain).
  async function toggleRail(cat: Category) {
    const { error } = await supabase.from('categories').update({ show_in_rail: !(cat.show_in_rail ?? true) }).eq('id', cat.id)
    if (error) toast.error(isRailColumnMissing(error) ? RAIL_MIGRATION_HINT : 'Failed update rail')
    load()
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Delete "${cat.name}"?\n\nProduct dalam category ini akan hilang category.`)) return
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) toast.error('Failed delete — mungkin ada product dalam category ini')
    else { toast.success('Category didelete'); load() }
  }

  // Drag & drop handlers
  function onDragStart(id: string) { setDragId(id) }

  function onDragEnter(id: string) {
    if (!dragId || dragId === id) return
    setCategories(prev => {
      const from = prev.findIndex(c => c.id === dragId)
      const to = prev.findIndex(c => c.id === id)
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  async function onDragEnd() {
    setDragId(null)
    setSavingOrder(true)
    await Promise.all(
      categories.map((cat, i) =>
        supabase.from('categories').update({ sort_order: i }).eq('id', cat.id)
      )
    )
    setSavingOrder(false)
    toast.success('Urutan disave')
  }

  const parents = categories.filter(c => c.parent_id === null)
  const children = categories.filter(c => c.parent_id !== null)
  // select('*') — kalau lajur show_in_rail tiada pada baris pertama, migration 125 belum jalan.
  const railColumnsMissing = categories.length > 0 && categories[0].show_in_rail === undefined

  // For display: render parents first, then each parent's children indented
  const orderedForDisplay: Array<Category & { isParent: boolean }> = []
  for (const p of parents) {
    orderedForDisplay.push({ ...p, isParent: true })
    for (const c of children.filter(ch => ch.parent_id === p.id)) {
      orderedForDisplay.push({ ...c, isParent: false })
    }
  }
  // Orphan children (no parent match — shouldn't happen but safe fallback)
  for (const c of children.filter(ch => !parents.some(p => p.id === ch.parent_id))) {
    orderedForDisplay.push({ ...c, isParent: false })
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Category Product</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {parents.length} parent · {children.length} sub-category · seret untuk susun semula
            {savingOrder && <span className="ml-2 text-blue-500">Menyimpan urutan...</span>}
            {railColumnsMissing && <span className="ml-2 text-gray-500">Migration 125 belum dijalankan — tetapan rail katalog tak aktif</span>}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" /> Category New
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-red-100 p-1.5 rounded-lg">
              <Tag className="h-4 w-4 text-red-600" />
            </div>
            <h2 className="font-bold text-gray-900">Category New</h2>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value, slug: autoSlug(e.target.value) }))}
                  required placeholder="Buah Import"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Slug</label>
                <input
                  value={form.slug}
                  onChange={e => setForm(p => ({ ...p, slug: e.target.value }))}
                  placeholder="buah-import"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Description ringkas category ini"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Parent Category</label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm(p => ({ ...p, parent_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                >
                  <option value="">— No (jadikan Parent) —</option>
                  {parents.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  {form.parent_id ? `Akan jadi sub-category di bawah "${parents.find(p => p.id === form.parent_id)?.name}"` : 'Akan jadi category utama (Parent)'}
                </p>
              </div>
              {/* Rail katalog (migration 125) */}
              <div className="col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.show_in_rail}
                    onChange={e => setForm(p => ({ ...p, show_in_rail: e.target.checked }))}
                    className="h-4 w-4 accent-gray-800"
                  />
                  Papar dalam rail katalog
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  Urutan rail
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.rail_order}
                    onChange={e => setForm(p => ({ ...p, rail_order: e.target.value }))}
                    className="w-20 border border-gray-200 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                </label>
                <p className="basis-full text-[11px] text-gray-400">
                  Sorok = produk digabung ke kategori induk (kalau induk dipapar), jika tidak ke seksyen “Lain-lain”. Urutan kecil dulu; Kurma guna 100 supaya di hujung.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories list */}
      <div className="space-y-1.5">
        {categories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-12 text-center text-gray-400">
            No category lagi. Add category pertama.
          </div>
        ) : (
          orderedForDisplay.map((cat) => (
            <div
              key={cat.id}
              draggable={editingId !== cat.id}
              onDragStart={() => onDragStart(cat.id)}
              onDragEnter={() => onDragEnter(cat.id)}
              onDragEnd={onDragEnd}
              onDragOver={e => e.preventDefault()}
              className={`bg-white rounded-2xl border shadow-sm transition-all ${
                cat.isParent ? 'border-gray-300 bg-gray-50' : 'ml-6 border-gray-100'
              } ${
                dragId === cat.id
                  ? 'opacity-40 border-dashed border-gray-400 cursor-grabbing'
                  : 'hover:border-gray-200 cursor-grab'
              } ${!cat.is_active ? 'opacity-60' : ''}`}
            >
              {editingId === cat.id ? (
                /* Edit mode */
                <form onSubmit={e => handleEdit(e, cat.id)} className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Slug</label>
                      <input
                        value={editForm.slug}
                        onChange={e => setEditForm(p => ({ ...p, slug: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                      <input
                        value={editForm.description}
                        onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Parent Category</label>
                      <select
                        value={editForm.parent_id}
                        onChange={e => setEditForm(p => ({ ...p, parent_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                      >
                        <option value="">— No (Parent) —</option>
                        {parents.filter(p => p.id !== cat.id).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    {/* Rail katalog (migration 125) */}
                    <div className="col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={editForm.show_in_rail}
                          onChange={e => setEditForm(p => ({ ...p, show_in_rail: e.target.checked }))}
                          className="h-4 w-4 accent-gray-800"
                        />
                        Papar dalam rail katalog
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        Urutan rail
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editForm.rail_order}
                          onChange={e => setEditForm(p => ({ ...p, rail_order: e.target.value }))}
                          className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <X className="h-3 w-3" /> Batal
                    </button>
                    <button type="submit" disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                /* View mode */
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {cat.isParent && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">PARENT</span>
                      )}
                      <span className={`font-semibold ${cat.isParent ? 'text-gray-900' : 'text-gray-700'}`}>{cat.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{cat.slug}</span>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{cat.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleActive(cat)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        cat.is_active
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {cat.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {cat.is_active ? 'Active' : 'Sembunyi'}
                    </button>
                    {cat.show_in_rail !== undefined && (
                      <button
                        onClick={() => toggleRail(cat)}
                        title={cat.show_in_rail ? 'Dipapar dalam rail katalog — klik untuk sorok' : 'Disorok dari rail katalog — klik untuk papar'}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                          cat.show_in_rail
                            ? 'bg-gray-800 text-white border-gray-800 hover:bg-gray-700'
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <PanelLeft className="h-3 w-3" />
                        Rail{cat.rail_order ? ` #${cat.rail_order}` : ''}
                      </button>
                    )}
                    <button
                      onClick={() => { setEditingId(cat.id); setEditForm({ name: cat.name, slug: cat.slug, description: cat.description ?? '', parent_id: cat.parent_id ?? '', show_in_rail: cat.show_in_rail ?? true, rail_order: String(cat.rail_order ?? 0) }) }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
