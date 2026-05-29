'use client'

import { useState, useRef } from 'react'
import { GripVertical, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type Product = { id: string; name: string; is_active: boolean }

export function SortList({ products: initial }: { products: Product[] }) {
  const [products, setProducts] = useState(initial)
  const [dragId, setDragId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dragOver = useRef<string | null>(null)
  const router = useRouter()

  function onDragStart(id: string) {
    setDragId(id)
  }

  function onDragEnter(id: string) {
    if (!dragId || dragId === id) return
    dragOver.current = id
    setProducts((prev) => {
      const from = prev.findIndex((p) => p.id === dragId)
      const to = prev.findIndex((p) => p.id === id)
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  function onDragEnd() {
    setDragId(null)
    dragOver.current = null
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/products/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: products.map((p) => p.id) }),
    })
    if (res.ok) {
      toast.success('Urutan disave')
      router.refresh()
    } else {
      toast.error('Failed save urutan')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="space-y-1.5">
        {products.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => onDragStart(p.id)}
            onDragEnter={() => onDragEnter(p.id)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border select-none transition-all ${
              dragId === p.id
                ? 'opacity-40 border-dashed border-gray-400 bg-gray-50 cursor-grabbing'
                : 'bg-white border-gray-100 shadow-sm hover:border-gray-300 cursor-grab'
            }`}
          >
            <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
            <span className="text-xs text-gray-400 w-5 text-right tabular-nums">{i + 1}</span>
            <span className="font-medium text-gray-900 flex-1 text-sm">{p.name}</span>
            {!p.is_active && (
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">inactive</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? 'Menyimpan...' : 'Save Urutan'}
        </button>
        <a
          href="/admin/products"
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Batal
        </a>
      </div>
    </div>
  )
}
