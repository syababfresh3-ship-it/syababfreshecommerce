'use client'

// Butang padam terus dari senarai produk (dulu hanya di bawah borang edit).
// Padam kekal (DELETE /api/admin/products/[id]); produk yang ada rekod order LP
// (lp_guest_orders.product_id tanpa cascade) akan ditolak DB → beri mesej jelas,
// cadangkan nyahaktif sahaja.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function DeleteProductButton({ id, name, compact = false }: { id: string; name: string; compact?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function remove() {
    if (!confirm(`Padam "${name}"? Tindakan ini tidak boleh diundur.`)) return
    setLoading(true)
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(`"${name}" dipadam`)
      router.refresh()
    } else {
      const j = await res.json().catch(() => ({}))
      const msg: string = j?.error ?? ''
      toast.error(/foreign key|violates|23503/i.test(msg)
        ? 'Produk ini ada rekod order (LP) — tak boleh dipadam. Matikan "Active" sahaja.'
        : msg || 'Gagal padam produk')
    }
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={loading}
      title="Padam produk"
      className={`inline-flex items-center gap-1 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 ${compact ? 'px-2 py-1.5' : 'px-2.5 py-1.5'}`}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  )
}
