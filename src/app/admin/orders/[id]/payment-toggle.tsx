'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'

export function PaymentToggle({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function markPaid() {
    if (status === 'paid') return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId)

    if (error) {
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
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Dibayar
      </span>
    )
  }

  return (
    <button
      onClick={markPaid}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {loading ? 'Menyimpan...' : 'Mark Sebagai Dibayar'}
    </button>
  )
}
