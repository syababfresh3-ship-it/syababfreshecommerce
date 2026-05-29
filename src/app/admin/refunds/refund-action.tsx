'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react'

export function RefundAction({ orderId, amount }: { orderId: string; amount: number }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleRefund() {
    if (!confirm(`Confirm refund RM${Number(amount).toFixed(2)} untuk orders ini?\n\nStatus akan bertukar kepada "Refunded".`)) return
    setLoading(true)
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'refunded', payment_status: 'refunded' }),
    })
    if (!res.ok) {
      toast.error('Failed proses refund')
    } else {
      toast.success('Refund success direkodkan')
      setDone(true)
      router.refresh()
    }
    setLoading(false)
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
        <CheckCircle2 className="h-4 w-4" /> Selesai
      </span>
    )
  }

  return (
    <button
      onClick={handleRefund}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {loading ? 'Memproses...' : 'Proses Refund'}
    </button>
  )
}
