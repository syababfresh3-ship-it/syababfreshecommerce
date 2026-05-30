'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const statusOptions = [
  { value: 'pending',    label: 'Pending' },
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'preparing',  label: 'Preparing' },
  { value: 'delivering', label: 'Shipped' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'cancelled',  label: 'Cancelled' },
  { value: 'refunded',   label: 'Refunded' },
]

const pushMessages: Record<string, { title: string; body: string }> = {
  confirmed:  { title: 'Orders Confirmed ✅', body: 'Orders anda telah diconfirm dan sedang disediakan.' },
  preparing:  { title: 'Sedang Preparing 🧺', body: 'Buah-buahan segar anda sedang diselect dengan teliti!' },
  delivering: { title: 'Dalam Pengsendan 🚚', body: 'Pengsend kami sedang dalam perjalanan ke address anda.' },
  delivered:  { title: 'Order Delivered 🎉', body: 'Your order has arrived. Enjoy!' },
  cancelled:  { title: 'Orders Cancelled ❌', body: 'Orders anda telah dibatalkan. Hubungi kami jika ada soalan.' },
}

interface OrderStatusUpdaterProps {
  orderId: string
  userId: string
  currentStatus: string
  deliveryMethod?: string
}

// Untuk order ambil sendiri (pickup), status 'delivering' bermaksud "sedia diambil"
// — bukan "dalam penghantaran". Push diubah ikut konteks.
const pickupPushMessages: Record<string, { title: string; body: string }> = {
  delivering: { title: 'Sedia Diambil 🎉', body: 'Pesanan anda sedia untuk diambil di kedai SyababFresh, Bangi.' },
  delivered:  { title: 'Pesanan Diterima 🎉', body: 'Terima kasih! Pesanan anda telah diambil.' },
}

export function OrderStatusUpdater({ orderId, userId, currentStatus, deliveryMethod }: OrderStatusUpdaterProps) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const isPickup = deliveryMethod === 'pickup'

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    if (newStatus === status) return

    setLoading(true)
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!res.ok) {
      toast.error('Failed update status')
    } else {
      setStatus(newStatus)
      toast.success('Status diupdate')
      // Notify customer via WhatsApp + Push (fire & forget)
      const push = (isPickup && pickupPushMessages[newStatus]) || pushMessages[newStatus]
      Promise.all([
        fetch('/api/notify-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, status: newStatus, deliveryMethod }),
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
