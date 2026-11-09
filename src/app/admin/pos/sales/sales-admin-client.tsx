'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, ChevronDown, ChevronUp, Ban, ExternalLink, Loader2 } from 'lucide-react'
import { fmtQty, rm } from '@/lib/pos/money'
import { fmtKl } from '@/lib/pos/receipt'
import { POS_PAY_LABEL, type PosPayMethod } from '@/lib/pos/types'
import { klDateStr } from '@/lib/pos/dates'

interface Item { name: string; variant_name: string | null; qty: number; unit: 'pcs' | 'kg'; unit_price: number; catalog_price: number | null; line_total: number }
interface Sale { id: string; receipt_no: string | null; local_ref: string | null; status: string; subtotal: number; discount_total: number; promo_code: string | null; promo_discount: number; rounding_adj: number; total: number; weight_kg_total: number; sold_at: string; customer_name: string | null; customer_phone: string | null; offline: boolean; void_reason: string | null; stock_notes: string | null; public_token: string; pos_cashiers: { name: string } | null; pos_registers: { code: string } | null; pos_payments: { method: PosPayMethod; amount: number; status: string }[] | null; pos_sale_items: Item[] | null }

export function PosSalesAdminClient() {
  const today = klDateStr(new Date())
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  const [tick, setTick] = useState(0)
  const qs = `from=${from}&to=${to}${status ? `&status=${status}` : ''}`
  const load = () => { setLoading(true); setTick(t => t + 1) }
  useEffect(() => {
    let alive = true
    fetch(`/api/admin/pos/sales?${qs}`).then(async res => {
      const j = await res.json().catch(() => ({}))
      if (!alive) return
      if (!res.ok) toast.error(j.error ?? 'Failed to load')
      setRows(j.sales ?? []); setLoading(false)
    }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [qs, tick])

  const voidSale = async (s: Sale) => {
    const reason = prompt(`Void receipt ${s.receipt_no ?? s.local_ref}? Enter a reason:`)
    if (!reason?.trim()) return
    const res = await fetch(`/api/pos/sales/${s.id}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(j.error ?? 'Void failed'); return }
    toast.success('Sale voided; packed stock restored'); load()
  }

  const total = rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.total), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">POS Sales</h1><p className="text-sm text-gray-500">{rows.length} sales · paid revenue {rm(total)}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm" />
          <span className="text-gray-400">–</span>
          <input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"><option value="">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="void">Void</option></select>
          <a href={`/api/admin/pos/sales?${qs}&format=csv`} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-gray-300 text-sm font-semibold bg-white"><Download className="h-4 w-4" /> CSV</a>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">Time</th><th className="px-3 py-2">Receipt</th><th className="px-3 py-2">Register · Cashier</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Payment</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No sales.</td></tr>}
            {rows.map(s => {
              const drift = (s.pos_sale_items ?? []).some(i => i.catalog_price != null && Number(i.catalog_price) !== Number(i.unit_price))
              return (
                <RowGroup key={s.id} s={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onVoid={() => voidSale(s)} drift={drift} />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RowGroup({ s, open, onToggle, onVoid, drift }: { s: Sale; open: boolean; onToggle: () => void; onVoid: () => void; drift: boolean }) {
  const pays = (s.pos_payments ?? []).filter(p => p.status === 'paid')
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-3 py-2 whitespace-nowrap text-gray-600 tabular-nums">{fmtKl(s.sold_at)}</td>
        <td className="px-3 py-2 font-semibold text-gray-900">{s.receipt_no ?? s.local_ref ?? '—'}{s.offline && <span className="ml-1 text-[10px] font-bold text-gray-400 uppercase">offline</span>}{drift && <span className="ml-1 text-[10px] font-bold text-amber-700 uppercase" title="Line price differs from the catalog price served to the device (price list / POS price)">drift</span>}</td>
        <td className="px-3 py-2 text-gray-600">{s.pos_registers?.code ?? '—'} · {s.pos_cashiers?.name ?? '—'}</td>
        <td className="px-3 py-2 text-gray-600">{s.customer_name ?? s.customer_phone ?? '—'}</td>
        <td className="px-3 py-2 text-gray-600">{pays.map(p => `${POS_PAY_LABEL[p.method]} ${rm(Number(p.amount))}`).join(' + ') || '—'}</td>
        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${s.status === 'void' ? 'line-through text-gray-400' : ''}`}>{rm(Number(s.total))}</td>
        <td className="px-3 py-2"><span className={`text-xs font-bold uppercase ${s.status === 'paid' ? 'text-gray-700' : s.status === 'void' ? 'text-red-600' : 'text-amber-700'}`}>{s.status}</span></td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <a href={`/pos/resit/${s.public_token}`} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100" title="Receipt"><ExternalLink className="h-4 w-4" /></a>
          {s.status !== 'void' && <button type="button" onClick={onVoid} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-red-700" title="Void"><Ban className="h-4 w-4" /></button>}
          <button type="button" onClick={onToggle} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/70">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <ul className="divide-y divide-gray-200">
                {(s.pos_sale_items ?? []).map((i, idx) => (
                  <li key={idx} className="py-1.5 flex justify-between gap-2"><span>{i.name}{i.variant_name && i.variant_name !== 'ikut berat' ? ` ${i.variant_name}` : ''} <span className="text-gray-500">· {fmtQty(Number(i.qty), i.unit)} × {rm(Number(i.unit_price))}{i.unit === 'kg' ? '/kg' : ''}{i.catalog_price != null && Number(i.catalog_price) !== Number(i.unit_price) ? ` (catalog ${rm(Number(i.catalog_price))})` : ''}</span></span><span className="font-semibold tabular-nums">{rm(Number(i.line_total))}</span></li>
                ))}
              </ul>
              <div className="space-y-1 tabular-nums text-gray-700">
                <div className="flex justify-between"><span>Subtotal</span><span>{rm(Number(s.subtotal))}</span></div>
                {Number(s.discount_total) > 0 && <div className="flex justify-between"><span>Discount</span><span>−{rm(Number(s.discount_total))}</span></div>}
                {Number(s.promo_discount) > 0 && <div className="flex justify-between"><span>Promo {s.promo_code}</span><span>−{rm(Number(s.promo_discount))}</span></div>}
                {Number(s.rounding_adj) !== 0 && <div className="flex justify-between"><span>Rounding</span><span>{rm(Number(s.rounding_adj))}</span></div>}
                <div className="flex justify-between font-bold text-gray-900"><span>Total</span><span>{rm(Number(s.total))}</span></div>
                {s.weight_kg_total > 0 && <p className="text-xs text-gray-500">Sold by weight {fmtQty(Number(s.weight_kg_total), 'kg')} (not deducted from store stock)</p>}
                {s.void_reason && <p className="text-xs text-red-700">Void: {s.void_reason}</p>}
                {s.stock_notes && <p className="text-xs text-amber-800 whitespace-pre-line">{s.stock_notes}</p>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
