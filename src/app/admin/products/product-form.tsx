'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ImageUploader } from '@/components/admin/image-uploader'
import type { Category, Product } from '@/types'

interface ProductFormProps {
  categories: Category[]
  product?: Product
}

export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter()
  const isEdit = !!product

  const [loading, setLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null)
  const [extraImages, setExtraImages] = useState<(string | null)[]>(
    // fill up to 2 slots from existing images[]
    [product?.images?.[0] ?? null, product?.images?.[1] ?? null]
  )
  const [form, setForm] = useState({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    description: product?.description ?? '',
    price: product?.price?.toString() ?? '',
    compare_price: product?.compare_price?.toString() ?? '',
    unit: product?.unit ?? 'kg',
    weight_kg: product?.weight_grams ? (product.weight_grams / 1000).toString() : '',
    category_id: product?.category_id ?? '',
    is_active: product?.is_active ?? true,
    is_featured: product?.is_featured ?? false,
    show_in_storefront: product?.show_in_storefront ?? true,
    is_shippable: product?.is_shippable ?? false,
    sort_order: product?.sort_order?.toString() ?? '0',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const name = e.target.value
    setForm((prev) => ({
      ...prev,
      name,
      slug: isEdit ? prev.slug : autoSlug(name),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.price || !form.slug) {
      toast.error('Name, slug dan price wajib diisi')
      return
    }

    setLoading(true)

    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      price: parseFloat(form.price),
      compare_price: form.compare_price ? parseFloat(form.compare_price) : null,
      unit: form.unit,
      weight_grams: form.weight_kg ? Math.round(parseFloat(form.weight_kg) * 1000) : null,
      category_id: form.category_id || null,
      image_url: imageUrl,
      images: extraImages.filter(Boolean) as string[],
      is_active: form.is_active,
      is_featured: form.is_featured,
      show_in_storefront: form.show_in_storefront,
      is_shippable: form.is_shippable,
      sort_order: parseInt(form.sort_order) || 0,
    }

    const res = isEdit
      ? await fetch(`/api/admin/products/${product.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Failed save product')
    } else {
      toast.success(isEdit ? 'Product diupdate' : 'Product ditambah')
      router.push('/admin/products')
      router.refresh()
    }

    setLoading(false)
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Delete "${product.name}"? Tindakan ini tidak boleh diundur.`)) return

    setLoading(true)
    const res = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed delete product')
    } else {
      toast.success('Product didelete')
      router.push('/admin/products')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Gambar Product */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-900">Gambar Product</h2>
          <span className="text-xs text-gray-400">Sehingga 3 gambar · 800×800px</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">Gambar 1 dipaparkan di kad product. All gambar boleh dilihat di halaman detail.</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1.5">Gambar 1 <span className="text-brand-fresh-500">(Utama)</span></p>
            <ImageUploader
              currentUrl={imageUrl}
              onUpload={(url) => setImageUrl(url)}
              onRemove={() => setImageUrl(null)}
              aspectRatio="aspect-square"
            />
          </div>
          {[0, 1].map((i) => (
            <div key={i}>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Gambar {i + 2}</p>
              <ImageUploader
                currentUrl={extraImages[i]}
                onUpload={(url) => setExtraImages(prev => { const next = [...prev]; next[i] = url; return next })}
                onRemove={() => setExtraImages(prev => { const next = [...prev]; next[i] = null; return next })}
                aspectRatio="aspect-square"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Maklumat Product</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name Product *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleNameChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="cth: Durian Musang King"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
            <input
              name="slug"
              value={form.slug}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="durian-musang-king"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Description ringkas product..."
            />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Price & Unit</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (RM) *</label>
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Asal (RM)</label>
            <input
              name="compare_price"
              type="number"
              step="0.01"
              min="0"
              value={form.compare_price}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              name="unit"
              value={form.unit}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {['kg', 'gram', 'biji', 'pack', 'set', 'kotak'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Berat (kg)</label>
            <input
              name="weight_kg"
              type="number"
              step="0.1"
              min="0"
              value={form.weight_kg}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="cth: 1"
            />
            <p className="text-[11px] text-gray-400 mt-1">Untuk kira kos shipping (Ninja Cold luar KV). Variant ada berat sendiri.</p>
          </div>
        </div>
      </div>

      {/* Category & Settings */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Category & Settings</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">— No Category —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
            <input
              name="sort_order"
              type="number"
              min="0"
              value={form.sort_order}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active (ditunjuk kepada customer)</label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="is_featured"
              name="is_featured"
              type="checkbox"
              checked={form.is_featured}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <label htmlFor="is_featured" className="text-sm font-medium text-gray-700">Featured (di halaman utama)</label>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="show_in_storefront"
              name="show_in_storefront"
              type="checkbox"
              checked={form.show_in_storefront}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="show_in_storefront" className="text-sm font-medium text-gray-700">Show in storefront (nampak di katalog; OFF = backend/landing je)</label>
          </div>
        </div>

        {/* Delivery scope */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Skop Pengsendan</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, is_shippable: false }))}
              className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                !form.is_shippable
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <span className="text-base">📍</span>
              <span className={`text-xs font-bold ${!form.is_shippable ? 'text-orange-700' : 'text-gray-500'}`}>
                Klang Valley sahaja
              </span>
              <span className="text-[10px] text-gray-400 leading-tight">
                Buah potong, product mudah rosak
              </span>
            </button>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, is_shippable: true }))}
              className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                form.is_shippable
                  ? 'border-brand-fresh-400 bg-brand-fresh-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <span className="text-base">📦</span>
              <span className={`text-xs font-bold ${form.is_shippable ? 'text-brand-fresh-700' : 'text-gray-500'}`}>
                Boleh dipos (seluruh Malaysia)
              </span>
              <span className="text-[10px] text-gray-400 leading-tight">
                Buah utuh, product kering
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
          >
            Delete Product
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Menyimpan...' : isEdit ? 'Update' : 'Add Product'}
          </button>
        </div>
      </div>
    </form>
  )
}
