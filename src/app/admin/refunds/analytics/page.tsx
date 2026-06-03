'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PAYMENT_LABELS, STATUS_LABELS } from '@/lib/refund-calc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Analytics = any

export default function RefundAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)

  useEffect(() => {
    fetch('/api/admin/refunds/analytics').then(r => r.json()).then(setData).catch(() => {})
  }, [])

  if (!data) return <div className="p-6 text-sm text-gray-400">Memuatkan…</div>

  const tallyRows = (m: Record<string, { count: number; amount: number }>, labels?: Record<string, string>) =>
    Object.entries(m).sort((a, b) => b[1].amount - a[1].amount).map(([k, v]) => (
      <div key={k} className="flex justify-between py-1.5 text-sm border-b border-gray-50 last:border-0">
        <span className="text-gray-600">{labels?.[k] ?? k}</span>
        <span className="text-gray-900 font-medium">{v.count} · RM{v.amount.toFixed(2)}</span>
      </div>
    ))

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <Link href="/admin/refunds" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <h1 className="text-xl font-bold text-gray-900">Analytics Refund</h1>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400">Jumlah Refund</p>
          <p className="text-2xl font-black text-red-600 mt-1">RM{Number(data.totalAmount).toFixed(2)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400">Bilangan</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{data.totalCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400">Belum Selesai</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{data.pendingCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Ikut Status</h2>
          {tallyRows(data.byStatus, STATUS_LABELS)}
        </section>
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Ikut Cara Bayar</h2>
          {tallyRows(data.byPaymentMethod, PAYMENT_LABELS)}
        </section>
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Ikut Supplier</h2>
          {tallyRows(data.bySupplier)}
        </section>
        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Ikut Bulan</h2>
          {tallyRows(data.byMonth)}
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm col-span-2">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Ikut Item</h2>
          {data.byItem && Object.keys(data.byItem).length > 0
            ? tallyRows(data.byItem)
            : <p className="text-sm text-gray-400">Tiada data item.</p>}
          <p className="text-[11px] text-gray-400 mt-2">Ikut produk dalam order yang di-refund. Order berbilang item dikira pada setiap produknya.</p>
        </section>
      </div>
    </div>
  )
}
