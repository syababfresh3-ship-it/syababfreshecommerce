'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Loader2, CreditCard } from 'lucide-react'

export function PaymentToggle({
  orderId,
  currentStatus,
  paymentMethod,
}: {
  orderId: string
  currentStatus: string
  paymentMethod: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    if (status === 'refunded') return
    const next = status === 'paid' ? 'unpaid' : 'paid'
    setLoading(true)
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: next }),
    })
    if (!res.ok) {
      toast.error('Gagal kemaskini bayaran')
    } else {
      setStatus(next)
      toast.success(next === 'paid' ? '✓ Ditanda dibayar' : 'Ditanda belum bayar')
      router.refresh()
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Tunggu...
      </span>
    )
  }

  if (status === 'refunded') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500">
        Dibayar Balik
      </span>
    )
  }

  if (status === 'paid') {
    return (
      <button
        onClick={toggle}
        title="Klik untuk tandakan belum bayar"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors cursor-pointer"
      >
        <Check className="h-3 w-3" />
        Dibayar
      </button>
    )
  }

  // Unpaid — most important: make it look like an action
  const isCod = paymentMethod === 'cod'
  const isBankTransfer = paymentMethod === 'bank_transfer'

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={toggle}
        title="Klik untuk tandakan sudah dibayar"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-dashed cursor-pointer transition-all hover:shadow-sm active:scale-95 ${
          isCod
            ? 'bg-amber-50 text-amber-700 border-amber-400 hover:bg-amber-100'
            : 'bg-red-50 text-red-600 border-red-400 hover:bg-red-100'
        }`}
      >
        <CreditCard className="h-3 w-3" />
        {isCod ? 'COD – Belum Terima' : isBankTransfer ? 'Transfer – Belum Sahkan' : 'Belum Bayar'}
      </button>
      <span className="text-[9px] text-gray-400 leading-none">↑ klik untuk tandakan bayar</span>
    </div>
  )
}
