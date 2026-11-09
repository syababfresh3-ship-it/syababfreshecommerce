'use client'

// Order borong — pantau & tukar status / bayaran TERUS dari page Borong (tak perlu buka Orders).
// Tulis melalui endpoint sedia ada /api/admin/landing-pages/orders (StatusDropdown / PaymentDropdown), jadi
// kesan sampingan (mata loyalty bila delivered, pulang stok bila batal) sama seperti di Orders.
// Bayaran sentiasa boleh ditanda manual (allowManual): order borong dikeyin staf, tiada webhook CHIP.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Package, FileText } from 'lucide-react'
import { StatusDropdown, PaymentDropdown } from '../orders/order-dropdowns'

export interface BorongOrder {
  id: string; order_number: string; name: string; reseller_id: string | null
  total: number; status: string; payment_status: string | null; payment_method: string
  delivery_method: string | null; pickup_date: string | null; created_at: string
  items: { product_name?: string; variant_name?: string | null; quantity?: number }[] | null
  product_name: string | null; variant_name: string | null; quantity: number | null
}

const PAY_LABEL: Record<string, string> = { bank_transfer: 'Bank Transfer', cod: 'COD', fpx: 'FPX', ewallet: 'E-Wallet' }
const CLOSED = new Set(['cancelled', 'refunded'])
const isPaid = (o: BorongOrder) => o.payment_status === 'paid' || o.payment_status === 'refunded'
// Belum selesai = masih ada kerja (belum delivered) ATAU masih ada hutang (delivered tapi belum bayar).
const isOpen = (o: BorongOrder) => !CLOSED.has(o.status) && (o.status !== 'delivered' || !isPaid(o))
const isUnpaid = (o: BorongOrder) => !CLOSED.has(o.status) && !isPaid(o)
const isDone = (o: BorongOrder) => o.status === 'delivered' && isPaid(o)

const rm = (n: number) => `RM${Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// timeZone tetap — elak beza server (UTC) vs pelayar (MYT) masa hydrate.
const fmtD = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kuala_Lumpur' })
const fmtYmd = (s: string) => new Date(`${s}T00:00:00+08:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kuala_Lumpur' })

function itemLines(o: BorongOrder): string[] {
  const items = Array.isArray(o.items) && o.items.length > 0
    ? o.items
    : [{ product_name: o.product_name ?? '—', variant_name: o.variant_name, quantity: o.quantity ?? 1 }]
  return items.map(i => `${i.product_name ?? '—'}${i.variant_name ? ` (${i.variant_name})` : ''} ×${i.quantity ?? 1}`)
}

type Filter = 'open' | 'unpaid' | 'done' | 'all'
const PAGE = 25

export function BorongOrders({ orders, resellerNames }: { orders: BorongOrder[]; resellerNames: Record<string, string> }) {
  const [filter, setFilter] = useState<Filter>('open')
  const [customer, setCustomer] = useState('')
  const [shown, setShown] = useState(PAGE)

  const nameOf = (o: BorongOrder) => (o.reseller_id && resellerNames[o.reseller_id]) || o.name
  const customers = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of orders) m.set(o.reseller_id ?? `n:${o.name}`, (o.reseller_id && resellerNames[o.reseller_id]) || o.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [orders, resellerNames])

  const byCustomer = customer ? orders.filter(o => (o.reseller_id ?? `n:${o.name}`) === customer) : orders
  const counts = { open: byCustomer.filter(isOpen).length, unpaid: byCustomer.filter(isUnpaid).length, done: byCustomer.filter(isDone).length, all: byCustomer.length }
  const owed = byCustomer.filter(isUnpaid).reduce((s, o) => s + Number(o.total || 0), 0)
  const rows = byCustomer.filter(filter === 'open' ? isOpen : filter === 'unpaid' ? isUnpaid : filter === 'done' ? isDone : () => true)
  const page = rows.slice(0, shown)

  const tabs: [Filter, string][] = [['open', 'Belum selesai'], ['unpaid', 'Belum bayar'], ['done', 'Selesai'], ['all', 'Semua']]
  const th = 'text-left font-bold px-3 py-2.5 whitespace-nowrap'

  return (
    <section className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Package className="h-4 w-4 text-gray-500" />Order Borong</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {counts.unpaid > 0 ? <>Belum bayar <span className="font-semibold text-gray-900">{rm(owed)}</span> · {counts.unpaid} order</> : 'Tiada bayaran tertunggak'}
            {' · '}tukar status &amp; bayaran terus di sini
          </p>
        </div>
        {customers.length > 1 && (
          <select value={customer} onChange={e => { setCustomer(e.target.value); setShown(PAGE) }} aria-label="Tapis pelanggan" className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700">
            <option value="">Semua pelanggan</option>
            {customers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setFilter(id); setShown(PAGE) }} aria-pressed={filter === id}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${filter === id ? 'bg-gray-900 border-gray-900 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            {label} <span className={filter === id ? 'text-white/70' : 'text-gray-400'}>{counts[id]}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className={th}>Tarikh</th><th className={th}>Order</th><th className={th}>Pelanggan</th><th className={th}>Item</th>
              <th className={`${th} text-right`}>Jumlah</th><th className={th}>Serahan</th><th className={th}>Status</th><th className={th}>Bayaran</th><th className={th}>Invois</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {page.map(o => {
              const lines = itemLines(o)
              return (
                <tr key={o.id} className="align-top">
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtD(o.created_at)}</td>
                  <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                    <Link href={`/admin/orders/lp/${o.id}`} className="text-gray-900 hover:underline" title="Buka butiran order">{o.order_number}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-gray-900 font-medium">{nameOf(o)}</td>
                  <td className="px-3 py-2.5 text-gray-600 min-w-[14rem] max-w-[24rem]">
                    {lines.slice(0, 2).map((l, i) => <p key={i} className="truncate">{l}</p>)}
                    {lines.length > 2 && <p className="text-xs text-gray-400">+{lines.length - 2} lagi</p>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-900 whitespace-nowrap">{rm(o.total)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                    {o.delivery_method === 'pickup' ? <>Pickup{o.pickup_date ? ` · ${fmtYmd(o.pickup_date)}` : ''}</> : 'Hantar'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusDropdown orderId={o.id} currentStatus={o.status} isLp />
                  </td>
                  <td className="px-3 py-2">
                    <PaymentDropdown orderId={o.id} currentStatus={o.payment_status ?? 'unpaid'} paymentMethod={o.payment_method} isLp allowManual />
                    <p className="text-[11px] text-gray-400 mt-0.5 pl-1">{PAY_LABEL[o.payment_method] ?? o.payment_method}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <a href={`/api/admin/resellers/invoice/${o.id}`} target="_blank" rel="noopener noreferrer" title="Invois PDF" aria-label={`Invois PDF ${o.order_number}`}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-400">
                      <FileText className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                {orders.length === 0 ? 'Belum ada order borong. Buat di Quick Order — pilih pelanggan borong.' : 'Tiada order dalam tapisan ini.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button type="button" onClick={() => setShown(s => s + PAGE)} className="mt-2 text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:border-gray-400">
          Tunjuk lagi ({rows.length - shown})
        </button>
      )}
    </section>
  )
}
