'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Check, X } from 'lucide-react'

// Kos penghantaran reseller (B2B) dirunding → boleh diubah terus dari detail order.
// Server kira semula total. Hanya dipapar untuk order source === 'reseller'.
export function ResellerDeliveryEdit({ orderId, deliveryFee }: { orderId: string; deliveryFee: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [val, setVal] = useState(String(deliveryFee))

  async function save() {
    const fee = Number(val)
    if (!Number.isFinite(fee) || fee < 0) { toast.error('Kos tidak sah'); return }
    setSaving(true)
    const res = await fetch('/api/admin/landing-pages/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, delivery_fee: fee }),
    })
    setSaving(false)
    if (!res.ok) { toast.error((await res.json().catch(() => ({})))?.error ?? 'Gagal simpan'); return }
    toast.success('Kos penghantaran dikemaskini')
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-gray-500">Delivery Fee</span>
        <span className="flex items-center gap-1.5">
          <span className="text-gray-400 text-xs">RM</span>
          <input
            type="number" min="0" step="0.01" value={val} autoFocus
            onChange={e => setVal(e.target.value)}
            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
          <button onClick={save} disabled={saving} className="text-green-600 hover:text-green-700 disabled:opacity-50"><Check className="h-4 w-4" /></button>
          <button onClick={() => { setEditing(false); setVal(String(deliveryFee)) }} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </span>
      </div>
    )
  }

  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">Delivery Fee</span>
      <span className="flex items-center gap-1.5">
        <span>RM{deliveryFee.toFixed(2)}</span>
        <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-violet-600"><Pencil className="h-3 w-3" /></button>
      </span>
    </div>
  )
}
