'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, PauseCircle, UserRound, PackagePlus, Tag, Scale, ChevronRight, Percent } from 'lucide-react'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { fmtQty, lineTotal, rm } from '@/lib/pos/money'
import type { PosTicketLine } from '@/lib/pos/types'

// Panel tiket: baris (stepper pcs / berat kg), diskaun, promo, pelanggan, tangguh, item manual, Pay.
export function TicketPanel({ onCharge, onEditLine, onDiscount, onCustomer, onHeld, onCustom }: {
  onCharge: () => void; onEditLine: (line: PosTicketLine) => void; onDiscount: () => void; onCustomer: () => void; onHeld: () => void; onCustom: () => void
}) {
  const t = usePosTicket()
  const totals = t.totals(false)
  const [promoCode, setPromoCode] = useState(t.promo?.code ?? '')
  const [promoBusy, setPromoBusy] = useState(false)
  const needsWeight = t.lines.some(l => l.unit === 'kg' && l.qty <= 0)

  const applyPromo = async () => {
    const code = promoCode.trim()
    if (!code) { t.setPromo(null); return }
    setPromoBusy(true)
    try {
      const res = await fetch('/api/pos/promo/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: totals.subtotal - totals.discountTotal, phone: t.customer?.phone || null, items: t.lines.filter(l => l.productId).map(l => ({ product_id: l.productId, line_total: lineTotal(l) })) }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { toast.error(j.error ?? 'Invalid promo code'); t.setPromo(null); return }
      t.setPromo({ id: j.promo.id, code: j.promo.code, discount: j.promo.discount })
      toast.success(`Promo ${j.promo.code}: −${rm(j.promo.discount)}`)
    } finally { setPromoBusy(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {t.lines.length === 0 ? (
          <p className="text-center text-[13px] text-gray-400 py-16">Tap a product to start a sale.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {t.lines.map(l => (
              <li key={l.lineId} className="py-2 flex items-center gap-1.5">
                <button type="button" onClick={() => onEditLine(l)} className="min-w-0 flex-1 text-left">
                  <p className="text-[13px] font-extrabold text-gray-900 truncate">{l.name}{l.variantName ? <span className="text-gray-500 font-semibold"> · {l.variantName}</span> : ''}</p>
                  <p className="text-[12px] text-gray-500 tabular-nums">{l.unit === 'kg' ? `${rm(l.unitPrice)}/kg` : rm(l.unitPrice)}{l.lineDiscount > 0 ? ` · discount ${rm(l.lineDiscount)}` : ''}</p>
                </button>
                {l.unit === 'kg' ? (
                  <button type="button" onClick={() => onEditLine(l)} className={`inline-flex items-center gap-1 h-10 px-3 rounded-xl text-[13px] font-bold ${l.qty > 0 ? 'bg-gray-100 text-gray-900' : 'bg-amber-100 text-amber-800'}`}>
                    <Scale className="h-3.5 w-3.5" />{l.qty > 0 ? fmtQty(l.qty, 'kg') : 'Weight?'}
                  </button>
                ) : (
                  <div className="inline-flex items-center rounded-xl bg-gray-100">
                    <button type="button" aria-label="Less" onClick={() => t.setQty(l.lineId, l.qty - 1)} className="h-10 w-10 grid place-items-center text-gray-700"><Minus className="h-4 w-4" /></button>
                    <button type="button" onClick={() => onEditLine(l)} className="w-9 text-center text-[14px] font-black tabular-nums">{l.qty}</button>
                    <button type="button" aria-label="More" onClick={() => t.setQty(l.lineId, l.qty + 1)} className="h-10 w-10 grid place-items-center text-gray-700"><Plus className="h-4 w-4" /></button>
                  </div>
                )}
                <p className="w-[72px] text-right text-[13px] font-black tabular-nums">{rm(lineTotal(l))}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 pt-3 space-y-2">
        <div className="flex gap-2">
          <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="Promo code" className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-[13px] font-semibold uppercase" />
          <button type="button" onClick={applyPromo} disabled={promoBusy} className="h-10 px-3 rounded-xl bg-gray-100 text-[12px] font-bold inline-flex items-center gap-1"><Tag className="h-3.5 w-3.5" />{t.promo ? 'Re-check' : 'Apply'}</button>
        </div>
        <div className="text-[14px] tabular-nums space-y-1">
          <div className="flex justify-between text-gray-600"><span>Subtotal ({totals.lineCount} {totals.lineCount === 1 ? 'line' : 'lines'}{totals.weightKg > 0 ? ` · ${fmtQty(totals.weightKg, 'kg')}` : ''})</span><span>{rm(totals.subtotal)}</span></div>
          <button type="button" onClick={onDiscount}
            className={`w-full h-11 px-3 -mx-1 rounded-xl flex items-center justify-between font-bold ${t.discount ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}>
            <span className="inline-flex items-center gap-1.5"><Percent className="h-4 w-4" />Discount{t.discount ? ` · ${t.discount.type === 'pct' ? `${t.discount.value}%` : rm(t.discount.value)}` : ''}<ChevronRight className="h-4 w-4 text-gray-400" /></span>
            <span className="text-[15px]">{totals.discountTotal > 0 ? `−${rm(totals.discountTotal)}` : 'Add'}</span>
          </button>
          {t.promo && <div className="flex justify-between text-gray-600"><span>Promo {t.promo.code}</span><span>−{rm(totals.promoDiscount)}</span></div>}
          <div className="flex justify-between text-[19px] font-black text-gray-900 pt-1"><span>Total</span><span>{rm(totals.total)}</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={onHeld} className="h-11 rounded-xl bg-gray-100 text-[12px] font-bold inline-flex items-center justify-center gap-1"><PauseCircle className="h-4 w-4" />Hold{t.held.length ? ` (${t.held.length})` : ''}</button>
          <button type="button" onClick={onCustomer} className={`h-11 rounded-xl text-[12px] font-bold inline-flex items-center justify-center gap-1 truncate px-1 ${t.customer ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}><UserRound className="h-4 w-4 shrink-0" /><span className="truncate">{t.customer ? (t.customer.name || t.customer.phone || 'Customer') : 'Customer'}</span></button>
          <button type="button" onClick={onCustom} className="h-11 rounded-xl bg-gray-100 text-[12px] font-bold inline-flex items-center justify-center gap-1"><PackagePlus className="h-4 w-4" />Other item</button>
        </div>
        <button type="button" onClick={onCharge} disabled={t.lines.length === 0 || needsWeight}
          className="w-full h-14 rounded-2xl text-white text-[17px] font-extrabold disabled:opacity-40" style={{ background: '#E11D2A' }}>
          {needsWeight ? 'Enter weight first' : `Pay ${rm(totals.total)}`}
        </button>
      </div>
    </div>
  )
}
