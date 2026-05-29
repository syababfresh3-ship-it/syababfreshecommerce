'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RotateCcw, Loader2 } from 'lucide-react'

export function RefundButton({ orderId, amount }: { orderId: string; amount: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRefund() {
    if (!confirm(`Proses refund RM${Number(amount).toFixed(2)} untuk orders ini?\n\nStatus akan bertukar kepada "Refunded".`)) return
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
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleRefund}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      {loading ? 'Memproses...' : 'Proses Refund'}
    </button>
  )
}
