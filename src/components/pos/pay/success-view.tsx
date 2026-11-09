'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Printer, MessageCircle, Plus } from 'lucide-react'
import { usePosSession } from '@/lib/stores/pos-session'
import { rm } from '@/lib/pos/money'
import { POS_PAY_LABEL } from '@/lib/pos/types'
import type { SaleDone } from '@/components/pos/pay/pay-view'

// Selepas bayar: baki besar, no. resit, kaedah bayar + nama pelanggan (supaya silap kaedah nampak segera),
// Print (window.open resit ?print=), WhatsApp (wa.me pra-isi), New sale.
export function SuccessView({ sale, customerPhone, customerName = null, onNew }: { sale: SaleDone; customerPhone: string | null; customerName?: string | null; onNew: () => void }) {
  const { settings } = usePosSession()
  const [phone, setPhone] = useState(customerPhone ?? '')
  const [busy, setBusy] = useState(false)
  const hasCash = sale.payments.some(p => p.method === 'cash')

  const print = () => {
    if (!sale.public_token) { toast.error('Receipt token missing'); return }
    window.open(`/pos/resit/${sale.public_token}?print=${settings?.paperWidth ?? 80}`, '_blank', 'noopener')
  }
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
          <p className="text-[13px] lg:text-[17px] font-bold text-gray-500">{sale.duplicate ? 'Sale was already recorded' : 'Sale complete'} · {sale.receipt_no ?? '—'}</p>
          {hasCash ? (
            <>
              <p className="text-[13px] lg:text-[17px] text-gray-500 mt-3">Change</p>
              <p className="text-[64px] lg:text-[96px] leading-none font-black text-gray-900 tabular-nums">{rm(sale.change)}</p>
            </>
          ) : (
            <p className="text-[48px] lg:text-[80px] leading-none font-black text-gray-900 tabular-nums mt-3">{rm(sale.total)}</p>
          )}
          <p className="text-[14px] lg:text-[18px] font-bold text-gray-800 mt-4">Paid by {sale.payments.map(p => `${POS_PAY_LABEL[p.method]} ${rm(p.amount)}`).join(' + ')}</p>
          {customerName && <p className="text-[13px] lg:text-[16px] text-gray-500 mt-1">Customer: {customerName}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={print} className="h-14 lg:h-[72px] rounded-2xl bg-white border border-gray-200 text-[14px] lg:text-[18px] font-extrabold inline-flex items-center justify-center gap-2"><Printer className="h-5 w-5" /> Print receipt</button>
          <button type="button" onClick={whatsapp} disabled={busy} className="h-14 lg:h-[72px] rounded-2xl bg-white border border-gray-200 text-[14px] lg:text-[18px] font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50"><MessageCircle className="h-5 w-5" /> WhatsApp</button>
        </div>
        <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number for e-receipt (optional)" className="w-full h-12 lg:h-14 px-4 rounded-2xl border border-gray-200 text-[14px] lg:text-[17px] text-center" />
        <button type="button" onClick={onNew} className="w-full h-14 lg:h-20 rounded-2xl text-white text-[17px] lg:text-[22px] font-extrabold inline-flex items-center justify-center gap-2" style={{ background: '#E11D2A' }}><Plus className="h-5 w-5" /> New sale</button>
      </div>
    </div>
  )
}
