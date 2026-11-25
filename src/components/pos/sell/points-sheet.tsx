'use client'

import { useState } from 'react'
import { Coins } from 'lucide-react'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { rm } from '@/lib/pos/money'
import { POS_REDEEM_MAX_PCT, POS_REDEEM_MAX_RM, maxRedeemablePoints, pointsToRm, rmToPoints } from '@/lib/pos/loyalty'

// Tebus mata loyalty terus dari tiket (migration 169). Hanya untuk ahli (customer.memberUserId) — baki dibaca semasa
// pelanggan dipilih; server sahkan semula baki & had (≤50% bil, ≤RM50) semasa bayar, tolak 409 POINTS_CHANGED kalau berubah.
// 100 mata = RM1. Kasyer masukkan RM (atau cip pantas) → mata dikira.
export function PointsSheet({ onClose }: { onClose: () => void }) {
  const t = usePosTicket()
  const totals = t.totals(false)
  const c = t.customer
  const balance = Math.max(0, Math.floor(c?.points ?? 0))
  const base = Math.max(0, totals.subtotal - totals.discountTotal - totals.promoDiscount)
  const max = maxRedeemablePoints(balance, base)
  const [rmText, setRmText] = useState(t.points ? pointsToRm(t.points.points).toFixed(2) : '')
  const rmVal = Number(rmText)
  const pts = Number.isFinite(rmVal) && rmVal > 0 ? rmToPoints(rmVal) : 0
  const tooMany = pts > max
  const canApply = pts > 0 && !tooMany && !!c?.memberUserId

  if (!c?.memberUserId) {
    return <p className="text-[14px] text-gray-600">Select a member first — only members with points can redeem.</p>
  }
  const apply = () => {
    if (!canApply) return
    t.setPoints({ userId: c.memberUserId!, points: pts })
    onClose()
  }
  const chips = [1, 5, 10, 20].filter(v => rmToPoints(v) <= max)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gray-50 p-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[14px] font-bold truncate">{c.name ?? c.phone}</p>
          <p className="text-[12px] text-gray-500">Balance {balance.toLocaleString('en-MY')} pts · worth {rm(pointsToRm(balance))}</p>
        </div>
        <Coins className="h-5 w-5 text-gray-400 shrink-0" />
      </div>
      <p className="text-[12px] text-gray-500">Max on this ticket: <span className="font-bold text-gray-800">{max.toLocaleString('en-MY')} pts = {rm(pointsToRm(max))}</span> (up to {POS_REDEEM_MAX_PCT}% of the bill, RM{POS_REDEEM_MAX_RM} per ticket)</p>
      <div className="flex gap-2 flex-wrap">
        {chips.map(v => <button key={v} type="button" onClick={() => setRmText(v.toFixed(2))} className="h-10 px-3 rounded-xl bg-gray-100 text-[13px] font-bold">RM{v}</button>)}
        {max > 0 && <button type="button" onClick={() => setRmText(pointsToRm(max).toFixed(2))} className="h-10 px-3 rounded-xl bg-gray-900 text-white text-[13px] font-bold">Use max</button>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-bold text-gray-500">RM</span>
        <input type="number" inputMode="decimal" min={0} step="1" value={rmText} onChange={e => setRmText(e.target.value)} placeholder="0.00" autoFocus
          className={`flex-1 h-14 px-4 rounded-2xl border text-[20px] font-black tabular-nums ${tooMany ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`} />
      </div>
      <p className={`text-[12px] font-semibold ${tooMany ? 'text-amber-800' : 'text-gray-500'}`}>
        {pts > 0 ? `= ${pts.toLocaleString('en-MY')} pts` : 'Enter an amount to redeem'}{tooMany ? ` — over the limit (${max.toLocaleString('en-MY')} pts)` : ''}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { t.setPoints(null); onClose() }} className="h-14 rounded-2xl bg-gray-100 text-[15px] font-bold">{t.points ? 'Remove points' : 'Cancel'}</button>
        <button type="button" onClick={apply} disabled={!canApply} className="h-14 rounded-2xl text-white text-[15px] font-extrabold disabled:opacity-40" style={{ background: '#111827' }}>
          {pts > 0 ? `Redeem −${rm(pointsToRm(pts))}` : 'Redeem'}
        </button>
      </div>
      <p className="text-[12px] text-gray-500">Points are deducted when the sale is paid and recorded against this cashier. Voiding the sale returns them.</p>
    </div>
  )
}
