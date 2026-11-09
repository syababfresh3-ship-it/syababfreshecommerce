'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Banknote, QrCode, CreditCard, Smartphone, Link2, Check, Loader2 } from 'lucide-react'
import { PosNumpad } from '@/components/pos/numpad'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { usePosSession } from '@/lib/stores/pos-session'
import { rm, round2 } from '@/lib/pos/money'
import type { PosPayMethod, PosPaymentInput, PosSalePayload } from '@/lib/pos/types'

// Skrin bayar: jumlah besar → pilih kaedah → pane kaedah → (berpecah: tambah tender seterusnya) → hantar.
// Tunai: tender pantas + baki, jumlah dibundar 5 sen. QR statik: papar imej + "Received".
// Terminal: rekod + rujukan pilihan. Pautan CHIP: Fasa 2 (jubin dimatikan). UI EN.

export interface SaleDone { id: string; receipt_no: string | null; public_token: string | null; total: number; change: number; payments: PosPaymentInput[]; duplicate: boolean }

const TILES: { m: PosPayMethod; label: string; icon: React.ElementType; soon?: boolean }[] = [
  { m: 'cash', label: 'Cash', icon: Banknote },
  { m: 'duitnow_qr', label: 'DuitNow QR', icon: QrCode },
  { m: 'card_terminal', label: 'Card (terminal)', icon: CreditCard },
  { m: 'ewallet_terminal', label: 'E-wallet (terminal)', icon: Smartphone },
  { m: 'chip_link', label: 'Payment link (Phase 2)', icon: Link2, soon: true },
]

export function PayView({ onBack, onDone, onPinRequired }: { onBack: () => void; onDone: (r: SaleDone) => void; onPinRequired: () => void }) {
  const t = usePosTicket()
  const { registerId, settings, nextLocalRef } = usePosSession()
  const [method, setMethod] = useState<PosPayMethod | null>(null)
  const [payments, setPayments] = useState<PosPaymentInput[]>([])
  const [tender, setTender] = useState('')
  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)

  const hasCash = method === 'cash' || payments.some(p => p.method === 'cash')
  const totals = useMemo(() => t.totals(hasCash), [t, hasCash])
  const paidSoFar = round2(payments.reduce((s, p) => s + p.amount, 0))
  const remaining = round2(Math.max(0, totals.total - paidSoFar))

  const submit = async (all: PosPaymentInput[]) => {
    setBusy(true)
    try {
      const payload: PosSalePayload = {
        client_txn_id: t.clientTxnId, register_id: registerId, customer: t.customer, lines: t.lines, discount: t.discount, promo: t.promo,
        payments: all, note: t.note, sold_at: new Date().toISOString(), offline: false,
        local_ref: nextLocalRef(),
      }
      const res = await fetch('/api/pos/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (res.status === 401 && j.code === 'PIN_REQUIRED') { toast.error('Enter the cashier PIN first'); onPinRequired(); return }
      if (!res.ok) { toast.error(j.error ?? 'Failed to save sale'); return }
      onDone({ id: j.id, receipt_no: j.receipt_no, public_token: j.public_token, total: j.total ?? totals.total, change: j.change_given ?? all.reduce((s, p) => s + (p.change_given ?? 0), 0), payments: all, duplicate: !!j.duplicate })
    } catch {
      toast.error('No connection — sale not saved. Try again (offline mode arrives in Phase 2).')
    } finally { setBusy(false) }
  }

  const addPayment = (p: PosPaymentInput) => {
    const all = [...payments, p]
    const paid = round2(all.reduce((s, x) => s + x.amount, 0))
    if (paid + 0.011 >= totals.total) submit(all)
    else { setPayments(all); setMethod(null); setTender(''); setRef(''); toast.message(`Balance ${rm(round2(totals.total - paid))} — choose the next method`) }
  }

  const tenderN = Number(tender) || 0
  const cashApplied = Math.min(tenderN, remaining)
  const change = round2(Math.max(0, tenderN - remaining))
  const quick = [remaining, 5, 10, 20, 50, 100].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v => round2(v))

  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 lg:p-6 gap-4 lg:gap-6">
      <div className="flex items-center gap-2">
        <button type="button" onClick={method ? () => { setMethod(null); setTender(''); setRef('') } : onBack} className="h-12 w-12 lg:h-14 lg:w-14 grid place-items-center rounded-xl bg-white border border-gray-200" aria-label="Back"><ArrowLeft className="h-6 w-6" /></button>
        <div className="flex-1">
          <p className="text-[13px] lg:text-[15px] font-bold text-gray-500">{payments.length > 0 ? `Balance due (${payments.length} ${payments.length === 1 ? 'tender' : 'tenders'} taken)` : 'Amount due'}</p>
          <p className="text-[40px] lg:text-[56px] leading-none font-black text-gray-900 tabular-nums">{rm(remaining)}</p>
          {totals.roundingAdj !== 0 && <p className="text-[11px] text-gray-500 mt-1">Includes cash rounding {totals.roundingAdj > 0 ? '+' : ''}{rm(totals.roundingAdj)}</p>}
        </div>
      </div>

      {!method && (
        <div className="grid grid-cols-2 gap-3">
          {TILES.map(tile => (
            <button key={tile.m} type="button" disabled={tile.soon || busy} onClick={() => setMethod(tile.m)}
              className="min-h-[112px] lg:min-h-[140px] rounded-2xl bg-white border border-gray-200 p-5 text-left active:bg-gray-100 disabled:opacity-40">
              <tile.icon className="h-7 w-7 lg:h-8 lg:w-8 text-gray-900" />
              <p className="text-[17px] lg:text-[20px] font-extrabold mt-3">{tile.label}</p>
            </button>
          ))}
        </div>
      )}

      {method === 'cash' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="rounded-2xl bg-white border border-gray-200 p-5">
              <p className="text-[13px] lg:text-[15px] font-bold text-gray-500">Cash received</p>
              <p className="text-[36px] lg:text-[48px] leading-none font-black tabular-nums mt-1">{rm(tenderN)}</p>
              <p className={`text-[17px] lg:text-[20px] font-black mt-3 ${tenderN >= remaining ? 'text-gray-900' : 'text-amber-700'}`}>{tenderN >= remaining ? `Change ${rm(change)}` : tenderN > 0 ? `Short ${rm(round2(remaining - tenderN))} — split payment allowed` : 'Enter the cash amount'}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {quick.map(v => <button key={v} type="button" onClick={() => setTender(String(v))} className="h-14 lg:h-16 rounded-xl bg-white border border-gray-200 text-[16px] lg:text-[18px] font-bold tabular-nums">{v === remaining ? 'Exact' : `RM${v}`}</button>)}
            </div>
          </div>
          <PosNumpad value={tender} onChange={setTender} decimal maxLen={8} disabled={busy} size="lg"
            onEnter={() => tenderN > 0 && addPayment({ method: 'cash', amount: round2(cashApplied), tendered: round2(tenderN), change_given: change, status: 'paid' })}
            enterLabel={busy ? 'Saving…' : tenderN >= remaining ? `Done · change ${rm(change)}` : tenderN > 0 ? `Take ${rm(cashApplied)}, pay the rest another way` : 'Enter cash'} />
        </div>
      )}

      {method === 'duitnow_qr' && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="rounded-2xl bg-white border border-gray-200 p-4 grid place-items-center min-h-[280px]">
            {settings?.duitnowQrUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={settings.duitnowQrUrl} alt="DuitNow QR" className="max-h-[320px] w-auto" />
              : <p className="text-[13px] text-gray-500 text-center">DuitNow QR image not set. Admin → POS → Settings.</p>}
          </div>
          <div className="space-y-3">
            <p className="text-[15px] lg:text-[17px] text-gray-600">Customer scans and pays <span className="font-black text-gray-900">{rm(remaining)}</span>. Check the bank notification <span className="font-bold">before</span> confirming.</p>
            <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Transaction reference (optional)" className="w-full h-12 lg:h-14 px-4 rounded-2xl border border-gray-200 text-[15px]" />
            <button type="button" disabled={busy} onClick={() => addPayment({ method: 'duitnow_qr', amount: remaining, ref: ref || null, status: 'paid' })} className="w-full h-14 lg:h-[76px] rounded-2xl text-white text-[16px] lg:text-[20px] font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: '#E11D2A' }}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Received {rm(remaining)}
            </button>
          </div>
        </div>
      )}

      {(method === 'card_terminal' || method === 'ewallet_terminal') && (
        <div className="max-w-lg space-y-3">
          {/* Kaedah yang dipilih dipapar jelas — pane Card & E-wallet serupa, dulu tak nampak beza (laporan pemilik 9 Nov) */}
          <div className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 text-white px-4 h-12 lg:h-14 text-[16px] lg:text-[19px] font-extrabold">
            {method === 'card_terminal' ? <CreditCard className="h-5 w-5 lg:h-6 lg:w-6" /> : <Smartphone className="h-5 w-5 lg:h-6 lg:w-6" />}
            {method === 'card_terminal' ? 'Card (terminal)' : 'E-wallet (terminal)'}
          </div>
          <p className="text-[15px] lg:text-[17px] text-gray-600">Process <span className="font-black text-gray-900">{rm(remaining)}</span> on the {method === 'card_terminal' ? 'card' : 'e-wallet'} terminal. Record it here once approved. Wrong method? Tap the back arrow.</p>
          <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Last 4 digits / reference (optional)" className="w-full h-12 lg:h-14 px-4 rounded-2xl border border-gray-200 text-[15px]" />
          <button type="button" disabled={busy} onClick={() => addPayment({ method, amount: remaining, ref: ref || null, status: 'paid' })} className="w-full h-14 lg:h-[76px] rounded-2xl text-white text-[16px] lg:text-[20px] font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: '#E11D2A' }}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {method === 'card_terminal' ? 'Card' : 'E-wallet'} approved {rm(remaining)}
          </button>
        </div>
      )}

      {payments.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-200 p-3 text-[12px] text-gray-600">
          Tenders taken: {payments.map((p, i) => <span key={i} className="font-bold text-gray-900">{TILES.find(x => x.m === p.method)?.label} {rm(p.amount)}{i < payments.length - 1 ? ' · ' : ''}</span>)}
          <button type="button" onClick={() => { setPayments([]); setMethod(null) }} className="ml-2 underline">Reset</button>
        </div>
      )}
    </div>
  )
}
