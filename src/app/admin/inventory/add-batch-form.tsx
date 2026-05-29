'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

interface Product { id: string; name: string }

export function AddBatchForm({ products }: { products: Product[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    expiry_date: '',
    supplier: '',
    cost_price: '',
    notes: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product_id || !form.quantity || !form.expiry_date) {
      toast.error('Product, kuantiti dan tarikh tamat wajib diisi')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('inventory_batches').insert({
      product_id: form.product_id,
      quantity: parseInt(form.quantity),
      expiry_date: form.expiry_date,
      batch_date: new Date().toISOString().split('T')[0],
      supplier: form.supplier || null,
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      notes: form.notes || null,
    })

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Batch stock ditambah')
      setForm({ product_id: '', quantity: '', expiry_date: '', supplier: '', cost_price: '', notes: '' })
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Product *</label>
        <select
          name="product_id"
          value={form.product_id}
          onChange={handleChange}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">— Select Product —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kuantiti *</label>
          <input
            name="quantity"
            type="number"
            min="1"
            value={form.quantity}
            onChange={handleChange}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Price Kos (RM)</label>
          <input
            name="cost_price"
            type="number"
            step="0.01"
            min="0"
            value={form.cost_price}
            onChange={handleChange}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Date Tamat Period *</label>
        <input
          name="expiry_date"
          type="date"
          value={form.expiry_date}
          onChange={handleChange}
          min={new Date().toISOString().split('T')[0]}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Pembekal</label>
        <input
          name="supplier"
          value={form.supplier}
          onChange={handleChange}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Name pembekal"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nota</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Nota tambahan..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {loading ? 'Menyimpan...' : 'Add Batch'}
      </button>
    </form>
  )
}
