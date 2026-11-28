'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Printer, MessageCircle, Plus, Coins } from 'lucide-react'
import { usePosSession } from '@/lib/stores/pos-session'
import { rm } from '@/lib/pos/money'
import { POS_PAY_LABEL } from '@/lib/pos/types'
import type { SaleDone } from '@/components/pos/pay/pay-view'
import { printReceiptSilently } from '@/components/pos/silent-print'
import { memberInviteLink } from '@/lib/pos/member-invite'

// Selepas bayar: baki besar, no. resit, kaedah bayar + nama pelanggan (supaya silap kaedah nampak segera),
// Print (window.open resit ?print=), WhatsApp (wa.me pra-isi), New sale.
export function SuccessView({ sale, customerPhone, customerName = null, onNew }: { sale: SaleDone; customerPhone: string | null; customerName?: string | null; onNew: () => void }) {
  const { settings } = usePosSession()
  const [phone, setPhone] = useState(customerPhone ?? '')
  const [busy, setBusy] = useState(false)
  const hasCash = sale.payments.some(p => p.method === 'cash')
  const pending = sale.status === 'pending'   // order pickup (170): belum bayar — invois, bukan resit
  const paper = settings?.paperWidth ?? 80

  const print = () => {
    if (!sale.public_token) { toast.error('Receipt token missing'); return }
    if (settings?.silentPrint) { printReceiptSilently(sale.public_token, paper); toast.success('Printing receipt…', { duration: 1500 }); return }
    window.open(`/pos/resit/${sale.public_token}?print=${paper}`, '_blank', 'noopener')
  }
  // Auto-print selepas jualan TUNAI (tetapan POS autoPrintCash) — sekali per jualan, senyap; pendua (jualan lama) tak dicetak lagi
  const autoPrinted = useRef<string | null>(null)
  useEffect(() => {
    if (!settings?.autoPrintCash || !hasCash || pending || sale.duplicate || !sale.public_token) return
    if (autoPrinted.current === sale.id) return
    autoPrinted.current = sale.id
    printReceiptSilently(sale.public_token, paper)
  }, [settings?.autoPrintCash, hasCash, pending, sale.duplicate, sale.public_token, sale.id, paper])
  const whatsapp = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/pos/sales/${sale.id}/receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone || null, mode: settings?.waReceiptMode ?? 'link', mark_sent: true }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Failed to prepare the receipt'); return }
      if (j.sent) { toast.success('E-receipt sent via WhatsApp'); return }
      window.open(j.waUrl, '_blank', 'noopener')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex-1 grid place-items-center p-4">
      <div className="w-full max-w-md lg:max-w-xl text-center space-y-5 lg:space-y-7">
        <CheckCircle2 className="h-14 w-14 lg:h-20 lg:w-20 mx-auto text-gray-900" />
        <div>
          <p className="text-[13px] lg:text-[17px] font-bold text-gray-500">{sale.duplicate ? 'Sale was already recorded' : pending ? 'Saved for pickup' : 'Sale complete'} · {sale.receipt_no ?? '—'}</p>
          {pending ? (
            <>
              <p className="text-[13px] lg:text-[17px] text-gray-500 mt-3">To pay at pickup</p>
              <p className="text-[48px] lg:text-[80px] leading-none font-black text-gray-900 tabular-nums">{rm(sale.total)}</p>
            </>
          ) : hasCash ? (
            <>
              <p className="text-[13px] lg:text-[17px] text-gray-500 mt-3">Change</p>
              <p className="text-[64px] lg:text-[96px] leading-none font-black text-gray-900 tabular-nums">{rm(sale.change)}</p>
            </>
          ) : (
            <p className="text-[48px] lg:text-[80px] leading-none font-black text-gray-900 tabular-nums mt-3">{rm(sale.total)}</p>
          )}
          {pending
            ? <p className="text-[14px] lg:text-[18px] font-bold text-gray-800 mt-4">Unpaid — the customer pays at the counter when collecting (Sales › Pickups waiting).</p>
            : <p className="text-[14px] lg:text-[18px] font-bold text-gray-800 mt-4">Paid by {sale.payments.map(p => `${POS_PAY_LABEL[p.method]} ${rm(p.amount)}`).join(' + ')}</p>}
          {customerName && <p className="text-[13px] lg:text-[16px] text-gray-500 mt-1">Customer: {customerName}</p>}
          {sale.loyalty?.member && (
            <p className="text-[13px] lg:text-[16px] font-bold text-gray-800 mt-2 inline-flex items-center gap-1.5"><Coins className="h-4 w-4" />
              {sale.loyalty.redeemed > 0 ? `Redeemed ${sale.loyalty.redeemed.toLocaleString('en-MY')} pts · ` : ''}Earned +{sale.loyalty.earned.toLocaleString('en-MY')} pts{sale.loyalty.balance != null ? ` · Balance ${sale.loyalty.balance.toLocaleString('en-MY')} pts` : ''}
            </p>
          )}
          {!sale.loyalty?.member && (sale.loyalty?.pending ?? 0) > 0 && !!customerPhone && (
            <>
            <p className="text-[13px] lg:text-[15px] text-gray-600 mt-2">{sale.loyalty!.pending.toLocaleString('en-MY')} pts pending for {customerPhone} — tell the customer to register at shop.syababfresh.my/daftar with this number to claim them.</p>
              <a href={memberInviteLink(customerPhone, sale.loyalty!.pending, customerName)} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center justify-center gap-1.5 h-12 px-5 rounded-2xl bg-white border border-gray-200 text-[14px] lg:text-[16px] font-extrabold"><Coins className="h-4 w-4" /> Invite to register (WhatsApp)</a>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={print} className="h-14 lg:h-[72px] rounded-2xl bg-white border border-gray-200 text-[14px] lg:text-[18px] font-extrabold inline-flex items-center justify-center gap-2"><Printer className="h-5 w-5" /> {pending ? 'Print invoice' : 'Print receipt'}</button>
          <button type="button" onClick={whatsapp} disabled={busy} className="h-14 lg:h-[72px] rounded-2xl bg-white border border-gray-200 text-[14px] lg:text-[18px] font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50"><MessageCircle className="h-5 w-5" /> {pending ? 'WhatsApp invoice' : 'WhatsApp'}</button>
        </div>
        <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number for e-receipt (optional)" className="w-full h-12 lg:h-14 px-4 rounded-2xl border border-gray-200 text-[14px] lg:text-[17px] text-center" />
        <button type="button" onClick={onNew} className="w-full h-14 lg:h-20 rounded-2xl text-white text-[17px] lg:text-[22px] font-extrabold inline-flex items-center justify-center gap-2" style={{ background: '#E11D2A' }}><Plus className="h-5 w-5" /> New sale</button>
      </div>
    </div>
  )
}
