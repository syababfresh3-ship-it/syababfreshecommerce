'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function PaymentToggle({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    const next = status === 'paid' ? 'unpaid' : 'paid'
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: next })
      .eq('id', orderId)

    if (error) {
      toast.error('Gagal kemaskini bayaran')
    } else {
      setStatus(next)
      toast.success(next === 'paid' ? 'Ditanda dibayar' : 'Ditanda belum bayar')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
        status === 'paid'
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : status === 'refunded'
          ? 'bg-gray-100 text-gray-600'
          : 'bg-red-100 text-red-600 hover:bg-red-200'
      }`}
    >
      {status === 'paid' ? 'Dibayar' : status === 'refunded' ? 'Refunded' : 'Belum Bayar'}
    </button>
  )
}
