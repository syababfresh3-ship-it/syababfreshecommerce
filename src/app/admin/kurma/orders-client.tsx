'use client'

// Enquiry Gift — peti masuk permintaan web dari Studio/LP (migration 137). Kerja selepas sebut harga
// berpindah ke Pipeline Gift. Tab ikut status gift_orders; "Bayar online" = status confirmed (deposit CHIP).
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Gift, FileText } from 'lucide-react'
import { GIFT_STATUSES } from '@/lib/gift'

interface Order {
  id: string; order_number: string; channel: string; name: string; phone: string; company: string | null
  quantity: number; total: number; deposit_amount: number; balance: number
  payment_status: string; status: string; created_at: string
}

const rm = (n: unknown) => `RM${Number(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const STATUS_CLS: Record<string, string> = {
  enquiry: 'bg-amber-50 text-amber-700 border-amber-200',
  quoted: 'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  in_production: 'bg-purple-50 text-purple-700 border-purple-200',
  ready: 'bg-teal-50 text-teal-700 border-teal-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}
const PAY_CLS: Record<string, string> = {
  unpaid: 'text-gray-400', deposit_paid: 'text-blue-600 font-semibold', paid: 'text-green-600 font-semibold', refunded: 'text-red-500',
}
const label = (s: string) => GIFT_STATUSES.find(x => x.id === s)?.label ?? s

export function GiftOrdersClient() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/kurma/orders?status=${filter}`)
    const j = await res.json().catch(() => ({}))
    setOrders(j.orders ?? [])
    setLoading(false)
  }, [filter])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])   // elak setState segerak dalam effect (lint)

  const stats = useMemo(() => {
    const s = { enquiry: 0, in_production: 0, ready: 0, deposit: 0 }
    for (const o of orders) {
      if (o.status === 'enquiry') s.enquiry++
      if (o.status === 'in_production') s.in_production++
      if (o.status === 'ready') s.ready++
      if (o.payment_status === 'deposit_paid' || o.payment_status === 'paid') s.deposit += Number(o.deposit_amount) || 0
    }
    return s
  }, [orders])

  // Peti enquiry web (25 Okt 2026): page ini = permintaan yang masuk sendiri dari Studio/LP.
  // Kerja selepas sebut harga dikeluarkan berpindah ke Pipeline Gift (/admin/gift-pipeline).
  const inbox = useMemo(() => ({
    baru: orders.filter(o => o.status === 'enquiry').length,
    quoted: orders.filter(o => o.status === 'quoted').length,
    paid: orders.filter(o => o.payment_status === 'deposit_paid' || o.payment_status === 'paid').length,
    deposit: stats.deposit,
  }), [orders, stats.deposit])
  const TABS: { id: string; label: string }[] = [
    { id: 'enquiry', label: 'Baru' }, { id: 'quoted', label: 'Dah sebut harga' }, { id: 'confirmed', label: 'Bayar online' },
    { id: 'all', label: 'Semua' }, { id: 'cancelled', label: 'Ditutup' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Gift className="h-5 w-5" />Enquiry Gift</h1>
          <p className="text-sm text-gray-500 mt-0.5">Permintaan yang masuk sendiri dari Studio & LP kurma. Tekan <b>Buat sebut harga</b> — selepas dikeluarkan, deal diurus di <Link href="/admin/gift-pipeline" className="underline">Pipeline Gift</Link>.</p>
        </div>
        <Link href="/admin/kurma/new" className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50"><Plus className="h-4 w-4" />Rekod enquiry manual</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Enquiry baru', value: String(inbox.baru) },
          { label: 'Dah sebut harga', value: String(inbox.quoted) },
          { label: 'Bayar deposit online', value: String(inbox.paid) },
          { label: 'Deposit dikutip (online)', value: rm(inbox.deposit) },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{c.label}</p>
            <p className="text-xl font-black text-gray-900 mt-1 tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(s => (
          <button key={s.id} onClick={() => setFilter(s.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === s.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s.label}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs"><tr>
            <th className="text-left px-4 py-2.5">Rujukan</th><th className="text-left px-4 py-2.5">Customer</th>
            <th className="text-right px-4 py-2.5">Qty</th><th className="text-right px-4 py-2.5">Anggaran</th>
            <th className="text-left px-4 py-2.5">Bayaran</th><th className="text-left px-4 py-2.5">Status</th>
            <th className="text-left px-4 py-2.5">Tarikh</th><th className="text-right px-4 py-2.5">Tindakan</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Tiada enquiry. Deal dari WhatsApp terus dibuat di <Link href="/admin/quotations/new" className="underline">Sebut harga baharu</Link>.</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} onClick={() => router.push(`/admin/kurma/${o.id}`)} className="cursor-pointer hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-bold text-red-600">{o.order_number}</span>
                  {o.channel === 'manual' && <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Manual</span>}
                </td>
                <td className="px-4 py-3"><div className="font-medium text-gray-900">{o.name}</div><div className="text-xs text-gray-400">{o.phone}{o.company ? ` · ${o.company}` : ''}</div></td>
                <td className="px-4 py-3 text-right tabular-nums">{o.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">{rm(o.total)}</td>
                <td className="px-4 py-3"><span className={`text-xs ${PAY_CLS[o.payment_status] ?? 'text-gray-400'}`}>{o.payment_status.replace('_', ' ')}</span></td>
                <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_CLS[o.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>{label(o.status)}</span></td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}</td>
                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                  {['enquiry', 'quoted', 'confirmed'].includes(o.status) && <Link href={`/admin/quotations/new?gift=${o.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-white bg-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-800 whitespace-nowrap"><FileText className="h-3.5 w-3.5" />Buat sebut harga</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">Bayaran deposit online (CHIP) direkod di sini oleh webhook; untuk jejak deal, buat sebut harga dari baris itu dan tanda deposit di Pipeline.</p>
    </div>
  )
}
