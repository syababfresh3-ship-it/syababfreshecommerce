'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// success page optimization: compact=true renders as quiet text link instead of red card
export function CancelButton({
  orderId,
  createdAt,
  compact = false,
}: {
  orderId: string
  createdAt: string
  compact?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const minutesElapsed = (Date.now() - new Date(createdAt).getTime()) / 60000
  if (minutesElapsed > 30) return null

  const minutesLeft = Math.max(0, Math.floor(30 - minutesElapsed))

  async function handleCancel() {
    if (!confirm('Batalkan pesanan ini?')) return
    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', orderId)

    if (error) {
      toast.error('Gagal batalkan pesanan')
    } else {
      toast.success('Pesanan dibatalkan')
      router.refresh()
    }
    setLoading(false)
  }

  // success page optimization: two-line compact cancel — info text then quiet action link
  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1">
        <p className="text-[11px] text-gray-400">
          Boleh batalkan dalam{' '}
          <span className="font-semibold text-gray-500">{minutesLeft} minit</span> lagi
        </p>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-400 underline underline-offset-2 decoration-gray-300 disabled:opacity-50 active:opacity-60 transition-opacity"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Batalkan pesanan
        </button>
      </div>
    )
  }

  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-2">
        Boleh batalkan dalam <span className="font-semibold text-red-600">{minutesLeft} minit</span> lagi
      </p>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-300 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Batalkan Pesanan
      </button>
    </div>
  )
}
