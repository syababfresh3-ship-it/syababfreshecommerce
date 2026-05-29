'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const STATUS_FLOW: Record<string, { next: string; label: string }> = {
  pending:    { next: 'confirmed',  label: '✓ Confirm Order' },
  confirmed:  { next: 'preparing', label: '▶ Start Preparing' },
  preparing:  { next: 'delivering',label: '🚚 Mark as Shipped' },
  delivering: { next: 'delivered', label: '✓ Mark as Delivered' },
}

interface Props {
  orderId: string
  currentStatus: string
  trackingUrl?: string | null
}

export function LpOrderActions({ orderId, currentStatus, trackingUrl }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const nextAction = STATUS_FLOW[currentStatus]

  async function update(status: string) {
    setLoading(true)
    const res = await fetch('/api/admin/landing-pages/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, status }),
    })
    if (!res.ok) { toast.error('Failed to update'); setLoading(false); return }

    toast.success(`Status → ${status}`)

    // Send WA to customer (same as main orders)
    fetch('/api/admin/landing-pages/notify-customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status, trackingUrl: trackingUrl || undefined }),
    }).catch(() => {})

    router.refresh()
    setLoading(false)
  }

  if (!nextAction && currentStatus !== 'delivered' && currentStatus !== 'cancelled') return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-900 mb-3">Update Status</h2>
      <div className="flex gap-2">
        {currentStatus !== 'delivered' && currentStatus !== 'cancelled' && (
          <button
            onClick={() => update('cancelled')}
            disabled={loading}
            className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 disabled:opacity-50 transition-colors"
          >Cancel Order</button>
        )}
        {nextAction && (
          <button
            onClick={() => update(nextAction.next)}
            disabled={loading}
            className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >{loading ? 'Updating...' : nextAction.label}</button>
        )}
        {currentStatus === 'delivered' && (
          <div className="flex-1 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-bold text-center border border-green-200">
            ✓ Order Delivered
          </div>
        )}
      </div>
    </div>
  )
}
