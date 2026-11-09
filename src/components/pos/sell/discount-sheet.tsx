'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PosNumpad } from '@/components/pos/numpad'
import { PinPad } from '@/components/pos/pin-pad'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { usePosSession } from '@/lib/stores/pos-session'
import { cartDiscountAmount, rm } from '@/lib/pos/money'

// Diskaun keseluruhan tiket (RM atau %). Melebihi had kasyer (tetapan cashierMaxDiscountPct)
// → perlu pengesahan PIN manager (verify_only, tanpa tukar kasyer semasa).
export function DiscountSheet({ onClose }: { onClose: () => void }) {
  const { discount, setDiscount, totals } = usePosTicket()
  const { cashier, isAdmin, settings } = usePosSession()
  const subtotal = totals(false).subtotal
  const [type, setType] = useState<'rm' | 'pct'>(discount?.type ?? 'pct')
  const [v, setV] = useState(discount ? String(discount.value) : '')
  const [note, setNote] = useState(discount?.note ?? '')
  const [needManager, setNeedManager] = useState(false)
  const value = Number(v) || 0
  const amount = cartDiscountAmount(subtotal, { type, value })
  const pct = subtotal > 0 ? (amount / subtotal) * 100 : 0
  const cap = settings?.cashierMaxDiscountPct ?? 10
  const overCap = !isAdmin && cashier?.role !== 'manager' && pct > cap + 1e-9

  const apply = () => {
    if (value <= 0) { setDiscount(null); onClose(); return }
    if (overCap) { setNeedManager(true); return }
    setDiscount({ type, value, note: note.trim() || null }); onClose()
  }
  const verifyManager = async (r: { cashier: { id: string }; pin: string }) => {
    const res = await fetch('/api/pos/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cashier_id: r.cashier.id, pin: r.pin, verify_only: true }) })
    if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error ?? 'Wrong manager PIN'); return }
    setDiscount({ type, value, note: note.trim() || null }); onClose()
  }

  if (needManager) return <PinPad mode="verify" onlyManager title={`Discount ${pct.toFixed(0)}% exceeds the cashier limit of ${cap}%. Confirm with a manager PIN.`} onDone={verifyManager} />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(['pct', 'rm'] as const).map(t => (
          <button key={t} type="button" onClick={() => { setType(t); setV('') }} className={`h-11 rounded-xl text-[14px] font-bold border ${type === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{t === 'pct' ? 'Percent %' : 'Ringgit RM'}</button>
        ))}
      </div>
      <div className="rounded-2xl bg-gray-50 p-4 flex items-end justify-between">
        <p className="text-[30px] leading-none font-black tabular-nums">{v || '0'}<span className="text-[16px] font-bold text-gray-500 ml-1">{type === 'pct' ? '%' : 'RM'}</span></p>
        <p className="text-[14px] font-bold text-gray-700">−{rm(amount)} <span className="text-gray-400 font-semibold">({pct.toFixed(1)}%)</span></p>
      </div>
      {overCap && <p className="text-[12px] font-semibold text-amber-700">Over the cashier limit of {cap}% — a manager PIN will be required.</p>}
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Reason (optional), e.g. bruised fruit" className="w-full h-11 px-3 rounded-xl border border-gray-200 text-[14px]" />
      <PosNumpad value={v} onChange={setV} decimal={type === 'rm'} maxLen={type === 'pct' ? 3 : 8} onEnter={apply} enterLabel={value > 0 ? `Apply discount −${rm(amount)}` : 'Remove discount'} />
    </div>
  )
}
