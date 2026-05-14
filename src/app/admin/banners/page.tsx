'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Loader2, Image, Eye, EyeOff, X, Pencil } from 'lucide-react'
import { ImageUploader } from '@/components/admin/image-uploader'
import NextImage from 'next/image'

interface Banner {
  id: string; title: string; subtitle: string | null
  link: string | null; link_label: string | null
  bg_class: string; image_url: string | null; is_active: boolean; sort_order: number
}

const bgOptions = [
  { value: 'gradient-brand',      label: 'Merah Brand',  preview: 'bg-red-600' },
  { value: 'bg-brand-fresh-600',  label: 'Hijau Fresh',  preview: 'bg-green-600' },
  { value: 'bg-gray-900',         label: 'Hitam',        preview: 'bg-gray-900' },
  { value: 'bg-blue-600',         label: 'Biru',         preview: 'bg-blue-600' },
  { value: 'bg-orange-500',       label: 'Oren',         preview: 'bg-orange-500' },
  { value: 'bg-purple-600',       label: 'Ungu',         preview: 'bg-purple-600' },
]

function BannerPreview({ title, subtitle, link_label, bg_class }: { title: string; subtitle?: string; link_label?: string; bg_class: string }) {
  const opt = bgOptions.find(o => o.value === bg_class)
  return (
    <div className={`${opt?.preview ?? 'bg-gray-800'} rounded-xl px-5 py-4 text-white relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_80%_50%,white,transparent)]" />
      <p className="font-black text-lg leading-tight">{title || 'Tajuk Banner'}</p>
      {subtitle && <p className="text-white/70 text-xs mt-1">{subtitle}</p>}
      {link_label && (
        <div className="mt-3 inline-flex bg-white/20 border border-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
          {link_label}
        </div>
      )}
    </div>
  )
}

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', subtitle: '', link: '/products',
    link_label: 'Beli Sekarang', bg_class: 'gradient-brand', image_url: '',
  })

  function openEdit(b: Banner) {
    setEditingBanner(b)
    setForm({
      title: b.title,
      subtitle: b.subtitle ?? '',
      link: b.link ?? '/products',
      link_label: b.link_label ?? 'Beli Sekarang',
      bg_class: b.bg_class,
      image_url: b.image_url ?? '',
    })
    setShowForm(false)
  }

  function closeEdit() {
    setEditingBanner(null)
    setForm({ title: '', subtitle: '', link: '/products', link_label: 'Beli Sekarang', bg_class: 'gradient-brand', image_url: '' })
  }

  async function load() {
    const res = await fetch('/api/admin/banners')
    if (res.ok) setBanners(await res.json())
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/admin/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title, subtitle: form.subtitle || null,
        link: form.link, link_label: form.link_label,
        bg_class: form.bg_class, image_url: form.image_url || null,
        sort_order: banners.length,
      }),
    })
    if (!res.ok) {
      toast.error('Gagal buat banner')
    } else {
      toast.success('Banner dicipta')
      setShowForm(false)
      setForm({ title: '', subtitle: '', link: '/products', link_label: 'Beli Sekarang', bg_class: 'gradient-brand', image_url: '' })
      load()
    }
    setLoading(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBanner) return
    setLoading(true)
    const res = await fetch(`/api/admin/banners/${editingBanner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title, subtitle: form.subtitle || null,
        link: form.link, link_label: form.link_label,
        bg_class: form.bg_class, image_url: form.image_url || null,
      }),
    })
    if (!res.ok) {
      toast.error('Gagal kemaskini banner')
    } else {
      toast.success('Banner dikemaskini')
      closeEdit()
      load()
    }
    setLoading(false)
  }

  async function toggleActive(b: Banner) {
    await fetch(`/api/admin/banners/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !b.is_active }),
    })
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Padam banner ini?')) return
    await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
    toast.success('Banner dipadam')
    load()
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Banner Utama</h1>
          <p className="text-sm text-gray-400 mt-0.5">{banners.filter(b => b.is_active).length} aktif · {banners.length} jumlah</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Banner Baru
          </button>
        )}
      </div>

      {/* Edit form */}
      {editingBanner && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 mb-5 ring-2 ring-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 p-1.5 rounded-lg">
                <Pencil className="h-4 w-4 text-blue-600" />
              </div>
              <h2 className="font-bold text-gray-900">Edit Banner</h2>
            </div>
            <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Preview</p>
            <BannerPreview title={form.title} subtitle={form.subtitle} link_label={form.link_label} bg_class={form.bg_class} />
          </div>

          <form onSubmit={handleEdit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tajuk *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Subtajuk</label>
              <input value={form.subtitle} onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Link</label>
                <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Label Butang</label>
                <input value={form.link_label} onChange={e => setForm(p => ({ ...p, link_label: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Warna (jika tiada gambar)</label>
              <div className="flex gap-2 flex-wrap">
                {bgOptions.map(o => (
                  <button key={o.value} type="button" onClick={() => setForm(p => ({ ...p, bg_class: o.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      form.bg_class === o.value ? 'border-gray-900 bg-gray-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <span className={`h-3.5 w-3.5 rounded-full ${o.preview} shrink-0`} />{o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Gambar Banner <span className="font-normal text-gray-400">(pilihan · 800×360px)</span></label>
              <ImageUploader
                currentUrl={form.image_url || null}
                onUpload={url => setForm(p => ({ ...p, image_url: url }))}
                onRemove={() => setForm(p => ({ ...p, image_url: '' }))}
                bucket="brand-assets"
                label="Banner (JPG, PNG, WebP · Max 5MB)"
                aspectRatio="aspect-[2.2/1]"
              />
              {form.image_url && (
                <p className="text-[10px] text-gray-400 mt-1">Gambar akan gantikan warna background</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={closeEdit}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Kemaskini Banner
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-red-100 p-1.5 rounded-lg">
                <Image className="h-4 w-4 text-red-600" />
              </div>
              <h2 className="font-bold text-gray-900">Banner Baru</h2>
            </div>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Live preview */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">Preview</p>
            <BannerPreview
              title={form.title}
              subtitle={form.subtitle}
              link_label={form.link_label}
              bg_class={form.bg_class}
            />
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tajuk *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required
                placeholder="Diskaun 20% Buah Import"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Subtajuk</label>
              <input value={form.subtitle} onChange={e => setForm(p => ({ ...p, subtitle: e.target.value }))}
                placeholder="Strawberry, Anggur, Epal — semua ada!"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Link</label>
                <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                  placeholder="/products"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Label Butang</label>
                <input value={form.link_label} onChange={e => setForm(p => ({ ...p, link_label: e.target.value }))}
                  placeholder="Beli Sekarang"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
            </div>
            {/* Color picker */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">Warna (jika tiada gambar)</label>
              <div className="flex gap-2 flex-wrap">
                {bgOptions.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, bg_class: o.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      form.bg_class === o.value
                        ? 'border-gray-900 bg-gray-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className={`h-3.5 w-3.5 rounded-full ${o.preview} shrink-0`} />
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Gambar Banner <span className="font-normal text-gray-400">(pilihan · 800×360px)</span></label>
              <ImageUploader
                currentUrl={form.image_url || null}
                onUpload={url => setForm(p => ({ ...p, image_url: url }))}
                onRemove={() => setForm(p => ({ ...p, image_url: '' }))}
                bucket="brand-assets"
                label="Banner (JPG, PNG, WebP · Max 5MB)"
                aspectRatio="aspect-[2.2/1]"
              />
              {form.image_url && (
                <p className="text-[10px] text-gray-400 mt-1">Gambar akan gantikan warna background</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Simpan Banner
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Banner list */}
      {banners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-14 text-center text-gray-400">
          Tiada banner lagi. Tambah banner pertama.
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map(b => {
            const opt = bgOptions.find(o => o.value === b.bg_class)
            return (
              <div key={b.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all ${!b.is_active ? 'opacity-60' : ''}`}>
                {/* Banner preview strip */}
                {b.image_url ? (
                  <div className="relative h-24 overflow-hidden">
                    <NextImage src={b.image_url} alt={b.title} fill className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-2">
                      <p className="font-black text-white text-sm">{b.title}</p>
                      {b.subtitle && <p className="text-white/70 text-xs">{b.subtitle}</p>}
                    </div>
                  </div>
                ) : (
                  <div className={`${opt?.preview ?? 'bg-gray-800'} px-5 py-3 flex items-center justify-between`}>
                    <div>
                      <p className="font-black text-white text-sm">{b.title}</p>
                      {b.subtitle && <p className="text-white/70 text-xs">{b.subtitle}</p>}
                    </div>
                    {b.link_label && (
                      <span className="text-[10px] font-bold text-white bg-white/20 border border-white/30 px-2 py-1 rounded-lg shrink-0">
                        {b.link_label}
                      </span>
                    )}
                  </div>
                )}
                {/* Actions row */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs text-gray-400 flex-1 truncate">{b.link ?? '—'}</span>
                  <button onClick={() => toggleActive(b)}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                      b.is_active
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}>
                    {b.is_active ? <><Eye className="h-3 w-3" /> Aktif</> : <><EyeOff className="h-3 w-3" /> Sembunyi</>}
                  </button>
                  <button onClick={() => openEdit(b)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(b.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
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
