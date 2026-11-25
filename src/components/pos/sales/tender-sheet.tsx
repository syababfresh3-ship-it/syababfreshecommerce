'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Banknote, QrCode, CreditCard, Smartphone, Handshake, Check, Loader2, ArrowLeft } from 'lucide-react'
import { PosNumpad } from '@/components/pos/numpad'
import { rm, round2, roundCash05 } from '@/lib/pos/money'
import type { PosPayMethod } from '@/lib/pos/types'

// Terima bayaran di kaunter (migration 170): kind 'pay' = order pickup pending → POST /api/pos/sales/:id/pay
// (tunai/QR/kad/e-wallet/kredit); kind 'settle' = selesaikan hutang kredit → POST /:id/settle (tanpa kredit).
// Tunai dibundar 5 sen (server laras total/rounding_adj untuk 'pay'). Bayaran bawa register semasa → shift/laci betul.
const TILES: { m: PosPayMethod; label: string; icon: React.ElementType }[] = [
  { m: 'cash', label: 'Cash', icon: Banknote },
  { m: 'duitnow_qr', label: 'DuitNow QR', icon: QrCode },
  { m: 'card_terminal', label: 'Card (terminal)', icon: CreditCard },
  { m: 'ewallet_terminal', label: 'E-wallet (terminal)', icon: Smartphone },
  { m: 'credit', label: 'Credit (pay later)', icon: Handshake },
]

export function TenderSheet({ saleId, amount, kind, allowCredit, registerId, onCancel, onDone }: {
  saleId: string; amount: number; kind: 'pay' | 'settle'; allowCredit: boolean; registerId: string | null
  onCancel: () => void; onDone: (method: PosPayMethod) => void
}) {
  const [method, setMethod] = useState<PosPayMethod | null>(null)
  const [tender, setTender] = useState('')
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const cashDue = roundCash05(amount).rounded
  const tenderN = Number(tender) || 0
  const change = round2(Math.max(0, tenderN - cashDue))
  const quick = [cashDue, 5, 10, 20, 50, 100].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v => round2(v))
  const tiles = TILES.filter(t => t.m !== 'credit' || (kind === 'pay' && allowCredit))

  const send = async (body: Record<string, unknown>) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/pos/sales/${saleId}/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, register_id: registerId }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Payment failed', { duration: 6000 }); return }
      onDone(body.method as PosPayMethod)
    } catch { toast.error('No connection — check Sales before trying again') } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 text-[13px]">
      <div className="flex items-center gap-2">
        <button type="button" onClick={method ? () => { setMethod(null); setTender(''); setRef('') } : onCancel} className="h-10 w-10 grid place-items-center rounded-xl bg-white border border-gray-200"><ArrowLeft className="h-4 w-4" /></button>
        <div><p className="text-[12px] font-bold text-gray-500">{kind === 'settle' ? 'Settle credit' : 'Amount due at pickup'}</p><p className="text-[26px] leading-none font-black tabular-nums">{rm(method === 'cash' ? cashDue : amount)}</p></div>
      </div>
      {!method && (
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(t => (
            <button key={t.m} type="button" disabled={busy} onClick={() => setMethod(t.m)} className="min-h-[88px] rounded-2xl bg-white border border-gray-200 p-4 text-left active:bg-gray-100">
              <t.icon className="h-6 w-6 text-gray-900" /><p className="text-[15px] font-extrabold mt-2">{t.label}</p>
            </button>
          ))}
        </div>
      )}
      {method === 'cash' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">{quick.map(v => <button key={v} type="button" onClick={() => setTender(String(v))} className="h-12 px-4 rounded-xl bg-white border border-gray-200 text-[15px] font-bold tabular-nums">{rm(v)}</button>)}</div>
          <PosNumpad value={tender} onChange={setTender} decimal maxLen={8} disabled={busy} />
          <p className="text-[15px]">Cash received <span className="font-black tabular-nums">{rm(tenderN)}</span>{tenderN >= cashDue - 0.001 ? <> · change <span className="font-black tabular-nums">{rm(change)}</span></> : <span className="text-amber-700"> · short {rm(round2(cashDue - tenderN))}</span>}</p>
          <button type="button" disabled={busy || tenderN < cashDue - 0.001} onClick={() => send({ method: 'cash', amount: cashDue, tendered: tenderN, change_given: change })} className="w-full h-14 rounded-2xl text-white text-[16px] font-extrabold disabled:opacity-40 inline-flex items-center justify-center gap-2" style={{ background: '#111827' }}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Cash {rm(cashDue)} received
          </button>
        </div>
      )}
      {(method === 'duitnow_qr' || method === 'card_terminal' || method === 'ewallet_terminal') && (
        <div className="space-y-3">
          <p className="text-gray-600">Take <span className="font-black text-gray-900">{rm(amount)}</span> by {TILES.find(t => t.m === method)?.label}. Record it here once confirmed.</p>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Reference (optional)" className="w-full h-12 px-4 rounded-xl border border-gray-200 text-[14px]" />
          <button type="button" disabled={busy} onClick={() => send({ method, amount, ref: ref || null })} className="w-full h-14 rounded-2xl text-white text-[16px] font-extrabold inline-flex items-center justify-center gap-2" style={{ background: '#111827' }}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {TILES.find(t => t.m === method)?.label} received {rm(amount)}
          </button>
        </div>
      )}
      {method === 'credit' && (
        <div className="space-y-3">
          <p className="text-gray-600">Goods are released now and <span className="font-black text-gray-900">{rm(amount)}</span> is recorded as owed by this customer. Settle it later from Sales › Credit outstanding.</p>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Note (optional, e.g. pay by Friday)" className="w-full h-12 px-4 rounded-xl border border-gray-200 text-[14px]" />
          <button type="button" disabled={busy} onClick={() => send({ method: 'credit', amount, ref: ref || null })} className="w-full h-14 rounded-2xl text-white text-[16px] font-extrabold inline-flex items-center justify-center gap-2" style={{ background: '#111827' }}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Handshake className="h-5 w-5" />} Record credit {rm(amount)}
          </button>
        </div>
      )}
    </div>
  )
}
