'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const statusOptions = [
  { value: 'pending',    label: 'Menunggu' },
  { value: 'confirmed',  label: 'Disahkan' },
  { value: 'preparing',  label: 'Disediakan' },
  { value: 'delivering', label: 'Dihantar' },
  { value: 'delivered',  label: 'Selesai' },
  { value: 'cancelled',  label: 'Dibatal' },
  { value: 'refunded',   label: 'Dibayar Balik' },
]

const pushMessages: Record<string, { title: string; body: string }> = {
  confirmed:  { title: 'Pesanan Disahkan ✅', body: 'Pesanan anda telah disahkan dan sedang disediakan.' },
  preparing:  { title: 'Sedang Disediakan 🧺', body: 'Buah-buahan segar anda sedang dipilih dengan teliti!' },
  delivering: { title: 'Dalam Penghantaran 🚚', body: 'Penghantar kami sedang dalam perjalanan ke alamat anda.' },
  delivered:  { title: 'Pesanan Selesai 🎉', body: 'Pesanan anda telah tiba. Selamat menikmati!' },
  cancelled:  { title: 'Pesanan Dibatal ❌', body: 'Pesanan anda telah dibatalkan. Hubungi kami jika ada soalan.' },
}

interface OrderStatusUpdaterProps {
  orderId: string
  userId: string
  currentStatus: string
}

export function OrderStatusUpdater({ orderId, userId, currentStatus }: OrderStatusUpdaterProps) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    if (newStatus === status) return

    setLoading(true)
    const supabase = createClient()

    const now = new Date().toISOString()
    const update: Record<string, string | null> = { status: newStatus }
    if (newStatus === 'confirmed')  update.confirmed_at  = now
    if (newStatus === 'preparing')  update.preparing_at  = now
    if (newStatus === 'delivering') update.delivering_at = now
    if (newStatus === 'delivered')  update.delivered_at  = now
    if (newStatus === 'cancelled')  update.cancelled_at  = now

    const { error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', orderId)

    if (error) {
      toast.error('Gagal kemaskini status')
    } else {
      setStatus(newStatus)
      toast.success('Status dikemaskini')
      // Notify customer via WhatsApp + Push (fire & forget)
      const push = pushMessages[newStatus]
      Promise.all([
        fetch('/api/notify-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, status: newStatus }),
        }),
        push ? fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, title: push.title, body: push.body, url: `/orders/${orderId}` }),
        }) : Promise.resolve(),
      ]).catch(() => {})
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={loading}
      className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
    >
      {statusOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}
