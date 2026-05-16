'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'pending',    label: 'Menunggu',       cls: 'text-yellow-700 bg-yellow-50' },
  { value: 'confirmed',  label: 'Disahkan',        cls: 'text-blue-700 bg-blue-50' },
  { value: 'preparing',  label: 'Disediakan',      cls: 'text-purple-700 bg-purple-50' },
  { value: 'delivering', label: 'Dihantar',        cls: 'text-orange-700 bg-orange-50' },
  { value: 'delivered',  label: 'Selesai',         cls: 'text-green-700 bg-green-50' },
  { value: 'cancelled',  label: 'Dibatal',         cls: 'text-red-600 bg-red-50' },
] as const

const PAYMENT_OPTIONS = [
  { value: 'unpaid', label: 'Belum Bayar', cls: 'text-gray-600 bg-gray-50' },
  { value: 'paid',   label: 'Dibayar',     cls: 'text-green-700 bg-green-50' },
] as const

export function StatusDropdown({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const current = STATUS_OPTIONS.find(o => o.value === status)

  async function handleChange(next: string) {
    if (next === status) return
    setLoading(true)
    const prev = status
    setStatus(next)
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) {
      toast.error('Gagal tukar status')
      setStatus(prev)
    } else {
      toast.success(`Status → ${STATUS_OPTIONS.find(o => o.value === next)?.label}`)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-400 absolute -left-4" />}
      <select
        value={status}
        onChange={e => handleChange(e.target.value)}
        disabled={loading || status === 'refunded'}
        className={`text-xs font-semibold border-0 rounded-lg px-2.5 py-1.5 pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 appearance-none disabled:opacity-50 ${current?.cls ?? 'text-gray-600 bg-gray-50'}`}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
      >
        {STATUS_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {status === 'refunded' && <option value="refunded">Dibayar Balik</option>}
      </select>
    </div>
  )
}

export function PaymentDropdown({
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

  const isAuto = paymentMethod === 'fpx' || paymentMethod === 'ewallet'
  const isRefunded = currentStatus === 'refunded'

  async function handleChange(next: string) {
    if (next === status) return
    setLoading(true)
    const prev = status
    setStatus(next)
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_status: next }),
    })
    if (!res.ok) {
      toast.error('Gagal tukar status bayaran')
      setStatus(prev)
    } else {
      toast.success(next === 'paid' ? 'Bayaran disahkan ✓' : 'Ditanda belum bayar')
      router.refresh()
    }
    setLoading(false)
  }

  if (isRefunded) {
    return <span className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-500">Dibayar Balik</span>
  }

  if (isAuto) {
    return (
      <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${status === 'paid' ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-50'}`}>
        {status === 'paid' ? 'Dibayar' : 'Auto (FPX/eWallet)'}
      </span>
    )
  }

  const current = PAYMENT_OPTIONS.find(o => o.value === status) ?? PAYMENT_OPTIONS[0]

  return (
    <div className="relative inline-flex items-center gap-1">
      {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-400 absolute -left-4" />}
      <select
        value={status}
        onChange={e => handleChange(e.target.value)}
        disabled={loading}
        className={`text-xs font-semibold border-0 rounded-lg px-2.5 py-1.5 pr-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 appearance-none disabled:opacity-50 ${current.cls}`}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
      >
        {PAYMENT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
