'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function PaymentToggle({
  orderId,
  currentStatus,
  paymentMethod,
  currentRef,
}: {
  orderId: string
  currentStatus: string
  paymentMethod?: string
  currentRef?: string | null
}) {
  const [status, setStatus] = useState(currentStatus)
  const [ref, setRef] = useState(currentRef ?? '')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const isBankTransfer = paymentMethod === 'bank_transfer'

  async function markPaid() {
    if (status === 'paid') return
    if (isBankTransfer && !ref.trim()) {
      toast.error('Sila masukkan nombor rujukan pindahan bank')
      return
    }
    setLoading(true)
    const body: Record<string, string> = { payment_status: 'paid' }
    if (ref.trim()) body.payment_ref = ref.trim()

    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      toast.error('Gagal kemaskini bayaran')
    } else {
      setStatus('paid')
      toast.success('Bayaran disahkan ✓')
      router.refresh()
    }
    setLoading(false)
  }

  if (status === 'paid') {
    return (
      <div className="space-y-1.5">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Dibayar
        </span>
        {currentRef && (
          <p className="text-xs text-gray-500">Ref: <span className="font-mono font-medium">{currentRef}</span></p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {isBankTransfer && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Nombor Rujukan Pindahan *
          </label>
          <input
            value={ref}
            onChange={e => setRef(e.target.value)}
            placeholder="cth: TT20240101123456"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      )}
      <button
        onClick={markPaid}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {loading ? 'Menyimpan...' : 'Mark Sebagai Dibayar'}
      </button>
    </div>
  )
}
