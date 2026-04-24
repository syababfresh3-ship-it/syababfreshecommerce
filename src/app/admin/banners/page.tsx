'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2 } from 'lucide-react'

interface Banner {
  id: string; title: string; subtitle: string | null
  link: string | null; link_label: string | null
  bg_class: string; is_active: boolean; sort_order: number
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', subtitle: '', link: '/products', link_label: 'Beli Sekarang', bg_class: 'gradient-brand' })

  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('banners').select('*').order('sort_order')
    setBanners(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('banners').insert({
      title: form.title, subtitle: form.subtitle || null,
      link: form.link, link_label: form.link_label,
      bg_class: form.bg_class, sort_order: banners.length,
    })
    if (error) toast.error('Gagal buat banner')
    else { toast.success('Banner dicipta'); setShowForm(false); setForm({ title: '', subtitle: '', link: '/products', link_label: 'Beli Sekarang', bg_class: 'gradient-brand' }); load() }
    setLoading(false)
  }

  async function toggleActive(b: Banner) {
    await supabase.from('banners').update({ is_active: !b.is_active }).eq('id', b.id)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Padam banner ini?')) return
    await supabase.from('banners').delete().eq('id', id)
    toast.success('Banner dipadam'); load()
  }

  const bgOptions = [
    { value: 'gradient-brand', label: 'Merah (Brand)' },
    { value: 'bg-brand-fresh-600', label: 'Hijau (Fresh)' },
    { value: 'bg-gray-900', label: 'Hitam' },
    { value: 'bg-blue-600', label: 'Biru' },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Banner Utama</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-brand-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-red-700">
            <Plus className="h-4 w-4" /> Banner Baru
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 p-5 mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tajuk *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="Diskaun 20% Buah Import" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Subtajuk</label>
              <input value={form.subtitle} onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="Strawberry, Anggur, Epal" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Link</label>
              <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="/products?promo=1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label Butang</label>
              <input value={form.link_label} onChange={e => setForm(p => ({ ...p, link_label: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Warna</label>
              <select value={form.bg_class} onChange={e => setForm(p => ({ ...p, bg_class: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {bgOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
            <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-brand-red-600 text-white rounded-lg hover:bg-brand-red-700 disabled:opacity-50">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {banners.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Tiada banner</p>}
        {banners.map(b => (
          <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
            <div className={`${b.bg_class} rounded-lg w-12 h-12 shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{b.title}</p>
              {b.subtitle && <p className="text-xs text-gray-400 truncate">{b.subtitle}</p>}
              <p className="text-xs text-gray-400 mt-0.5">{b.link}</p>
            </div>
            <button onClick={() => toggleActive(b)} className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${b.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {b.is_active ? 'Aktif' : 'Tidak Aktif'}
            </button>
            <button onClick={() => handleDelete(b.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
