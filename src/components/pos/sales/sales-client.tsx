'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Printer, MessageCircle, Ban, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { PosSheet } from '@/components/pos/sheet'
import { PinPad } from '@/components/pos/pin-pad'
import { usePosSession } from '@/lib/stores/pos-session'
import { fmtQty, rm } from '@/lib/pos/money'
import { fmtKl } from '@/lib/pos/receipt'
import { POS_PAY_LABEL, type PosPayMethod, type PosSaleDetail } from '@/lib/pos/types'
import type { PosDayReport } from '@/lib/pos/reports'
import { klDateStr, shiftDateStr } from '@/lib/pos/dates'

// Jualan hari ini (atau tarikh lain) + laporan X ringkas. Ketuk baris → butiran: cetak semula,
// WhatsApp e-resit, void (manager/admin; kasyer biasa perlu PIN manager). UI EN.

interface Row { id: string; receipt_no: string | null; local_ref: string | null; status: string; total: number; change_given: number; weight_kg_total: number; sold_at: string; customer_name: string | null; customer_phone: string | null; offline: boolean; void_reason: string | null; public_token: string; pos_cashiers: { name: string } | null; pos_payments: { method: PosPayMethod; amount: number; status: string }[] | null }

export function SalesClient() {
  const { cashier, isAdmin, settings, registerId } = usePosSession()
  const [date, setDate] = useState(klDateStr(new Date()))
  const [rows, setRows] = useState<Row[]>([])
  const [report, setReport] = useState<PosDayReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<PosSaleDetail | null>(null)
  const [voidMode, setVoidMode] = useState<null | 'reason' | 'pin'>(null)
  const [reason, setReason] = useState('')
  const [allRegisters, setAllRegisters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const reg = !allRegisters && registerId ? `&register=${registerId}` : ''
      const [a, b] = await Promise.all([fetch(`/api/pos/sales?date=${date}${reg}`), fetch(`/api/pos/report?date=${date}${reg}`)])
      const ja = await a.json().catch(() => ({})); const jb = await b.json().catch(() => null)
      if (!a.ok) toast.error(ja.error ?? 'Failed to load sales')
      setRows(ja.sales ?? []); setReport(b.ok ? jb : null)
    } finally { setLoading(false) }
  }, [date, registerId, allRegisters])
  useEffect(() => { load() }, [load])

  const open = async (id: string) => {
    const res = await fetch(`/api/pos/sales/${id}`)
    if (res.ok) setDetail(await res.json()); else toast.error('Failed to open sale')
  }
  const print = (token: string) => window.open(`/pos/resit/${token}?print=${settings?.paperWidth ?? 80}`, '_blank', 'noopener')
  const whatsapp = async (id: string) => {
    const res = await fetch(`/api/pos/sales/${id}/receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: settings?.waReceiptMode ?? 'link', mark_sent: true }) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(j.error ?? 'Failed'); return }
    if (j.sent) toast.success('E-receipt sent'); else window.open(j.waUrl, '_blank', 'noopener')
  }
  const doVoid = async (manager?: { id: string; pin: string }) => {
    if (!detail) return
    const res = await fetch(`/api/pos/sales/${detail.sale.id}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, manager_id: manager?.id, manager_pin: manager?.pin }) })
    const j = await res.json().catch(() => ({}))
    if (res.status === 403 && j.code === 'MANAGER_REQUIRED') { setVoidMode('pin'); if (manager) toast.error(j.error); return }
    if (!res.ok) { toast.error(j.error ?? 'Void failed'); return }
    toast.success('Sale voided, stock returned')
    setVoidMode(null); setReason(''); setDetail(null); load()
  }

  const methodLabel = (r: Row) => (r.pos_payments ?? []).filter(p => p.status === 'paid').map(p => POS_PAY_LABEL[p.method]).join(' + ') || '—'

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-5 max-w-5xl w-full mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setDate(shiftDateStr(date, -1))} aria-label="Previous day" className="h-11 w-11 grid place-items-center rounded-xl bg-white border border-gray-200"><ChevronLeft className="h-5 w-5" /></button>
        <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="h-11 px-3 rounded-xl bg-white border border-gray-200 text-[14px] font-bold" />
        <button type="button" onClick={() => setDate(shiftDateStr(date, 1))} disabled={date >= klDateStr(new Date())} aria-label="Next day" className="h-11 w-11 grid place-items-center rounded-xl bg-white border border-gray-200 disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button>
        <label className="ml-auto inline-flex items-center gap-2 text-[12px] font-bold text-gray-600"><input type="checkbox" checked={allRegisters} onChange={e => setAllRegisters(e.target.checked)} className="h-4 w-4" /> <span className="sm:hidden">All</span><span className="hidden sm:inline">All registers</span></label>
        <button type="button" onClick={load} aria-label="Refresh" className="h-11 w-11 grid place-items-center rounded-xl bg-white border border-gray-200"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Stat label="Sales" value={String(report.sales)} sub={report.voids ? `${report.voids} void` : undefined} />
          <Stat label="Revenue" value={rm(report.revenue)} sub={report.discount > 0 ? `discounts ${rm(report.discount)}` : undefined} />
          <Stat label="Cash" value={rm(report.byMethod.cash?.amount ?? 0)} sub={report.cashChange > 0 ? `change given ${rm(report.cashChange)}` : undefined} />
          <Stat label="Non-cash" value={rm((report.byMethod.duitnow_qr?.amount ?? 0) + (report.byMethod.card_terminal?.amount ?? 0) + (report.byMethod.ewallet_terminal?.amount ?? 0) + (report.byMethod.chip_link?.amount ?? 0))} sub={report.weightKg > 0 ? `fruit ${fmtQty(report.weightKg, 'kg')}` : undefined} />
        </div>
      )}

      <ul className="rounded-2xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {rows.length === 0 && !loading && <li className="p-8 text-center text-[13px] text-gray-400">No sales on this date.</li>}
        {rows.map(r => (
          <li key={r.id}>
            <button type="button" onClick={() => open(r.id)} className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-gray-50">
              <div className="w-[52px] text-[12px] font-bold text-gray-500 tabular-nums">{fmtKl(r.sold_at).slice(-5)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-extrabold truncate">{r.receipt_no ?? r.local_ref ?? '—'} <span className="text-gray-400 font-semibold">· {methodLabel(r)}</span></p>
                <p className="text-[12px] text-gray-500 truncate">{r.pos_cashiers?.name ?? 'No cashier'}{r.customer_name || r.customer_phone ? ` · ${r.customer_name ?? r.customer_phone}` : ''}{r.offline ? ' · offline' : ''}</p>
              </div>
              <div className="text-right">
                <p className={`text-[14px] font-black tabular-nums ${r.status === 'void' ? 'line-through text-gray-400' : ''}`}>{rm(Number(r.total))}</p>
                {r.status !== 'paid' && <p className={`text-[10px] font-bold uppercase ${r.status === 'void' ? 'text-red-600' : 'text-amber-700'}`}>{r.status}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <PosSheet open={!!detail} onClose={() => { setDetail(null); setVoidMode(null); setReason('') }} title={detail?.sale.receipt_no ?? detail?.sale.local_ref ?? 'Sale'} side="right">
        {detail && voidMode === null && (
          <div className="space-y-4 text-[13px]">
            <p className="text-gray-500">{fmtKl(detail.sale.sold_at)} · {detail.registerCode ?? '—'} · {detail.cashierName ?? 'No cashier'}{detail.sale.status === 'void' ? ` · VOID (${detail.sale.void_reason})` : ''}</p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {detail.items.map(it => (
                <li key={it.id} className="px-3 py-2 flex justify-between gap-2">
                  <span className="min-w-0"><span className="font-bold">{it.name}</span>{it.variant_name && it.variant_name !== 'ikut berat' ? ` ${it.variant_name}` : ''}<span className="block text-gray-500">{fmtQty(Number(it.qty), it.unit)} × {rm(Number(it.unit_price))}{it.unit === 'kg' ? '/kg' : ''}{Number(it.stock_short) > 0 ? ` · store stock short ${it.stock_short}` : ''}</span></span>
                  <span className="font-bold tabular-nums">{rm(Number(it.line_total))}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 tabular-nums">
              {Number(detail.sale.discount_total) > 0 && <div className="flex justify-between text-gray-600"><span>Discount</span><span>−{rm(Number(detail.sale.discount_total))}</span></div>}
              {Number(detail.sale.promo_discount) > 0 && <div className="flex justify-between text-gray-600"><span>Promo {detail.sale.promo_code}</span><span>−{rm(Number(detail.sale.promo_discount))}</span></div>}
              {Number(detail.sale.rounding_adj) !== 0 && <div className="flex justify-between text-gray-600"><span>Rounding</span><span>{rm(Number(detail.sale.rounding_adj))}</span></div>}
              <div className="flex justify-between text-[16px] font-black"><span>Total</span><span>{rm(Number(detail.sale.total))}</span></div>
              {detail.payments.filter(p => p.status === 'paid').map(p => <div key={p.id} className="flex justify-between text-gray-600"><span>{POS_PAY_LABEL[p.method]}{p.ref ? ` · ${p.ref}` : ''}{p.tendered != null ? ` (cash ${rm(Number(p.tendered))}, change ${rm(Number(p.change_given ?? 0))})` : ''}</span><span>{rm(Number(p.amount))}</span></div>)}
            </div>
            {detail.sale.stock_notes && <p className="rounded-xl bg-amber-50 text-amber-900 p-3 text-[12px] font-semibold whitespace-pre-line">{detail.sale.stock_notes}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => print(detail.sale.public_token)} className="h-12 rounded-xl bg-white border border-gray-200 font-bold inline-flex items-center justify-center gap-1.5"><Printer className="h-4 w-4" /> Print</button>
              <button type="button" onClick={() => whatsapp(detail.sale.id)} className="h-12 rounded-xl bg-white border border-gray-200 font-bold inline-flex items-center justify-center gap-1.5"><MessageCircle className="h-4 w-4" /> WhatsApp</button>
            </div>
            {detail.sale.status !== 'void' && (
              <button type="button" onClick={() => setVoidMode('reason')} className="w-full h-12 rounded-xl bg-red-50 text-red-700 font-bold inline-flex items-center justify-center gap-1.5"><Ban className="h-4 w-4" /> Void sale</button>
            )}
          </div>
        )}
        {detail && voidMode === 'reason' && (
          <div className="space-y-3">
            <p className="text-[13px] text-gray-600">Voiding cancels receipt <span className="font-bold">{detail.sale.receipt_no}</span> and returns packed stock. {isAdmin || cashier?.role === 'manager' ? '' : 'A manager PIN is required.'}</p>
            <input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (required)" className="w-full h-12 px-4 rounded-xl border border-gray-300 text-[14px]" />
            <button type="button" disabled={!reason.trim()} onClick={() => doVoid()} className="w-full h-12 rounded-xl bg-red-600 text-white font-extrabold disabled:opacity-40">Confirm void</button>
          </div>
        )}
        {detail && voidMode === 'pin' && <PinPad mode="verify" onlyManager title="Confirm the void with a manager PIN" onDone={r => doVoid({ id: r.cashier.id, pin: r.pin })} />}
      </PosSheet>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-3">
      <p className="text-[11px] font-bold text-gray-500">{label}</p>
      <p className="text-[20px] font-black tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
