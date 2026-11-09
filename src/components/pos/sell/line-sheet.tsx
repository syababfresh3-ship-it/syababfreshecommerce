'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { PosNumpad } from '@/components/pos/numpad'
import { WeightKeypad } from '@/components/pos/sell/weight-keypad'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { usePosSession } from '@/lib/stores/pos-session'
import { lineTotal, rm } from '@/lib/pos/money'
import type { PosTicketLine } from '@/lib/pos/types'

// Edit satu baris tiket: kuantiti/berat, diskaun baris (RM), harga unit (manager/admin/item manual), buang.

type Tab = 'qty' | 'disc' | 'price'

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={`h-10 px-3 rounded-xl text-[13px] font-bold ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>
}

export function LineSheet({ line, onClose }: { line: PosTicketLine; onClose: () => void }) {
  const { setQty, setLineDiscount, setUnitPrice, removeLine } = usePosTicket()
  const { cashier, isAdmin } = usePosSession()
  const canEditPrice = isAdmin || cashier?.role === 'manager' || line.productId === null
  const [tab, setTab] = useState<Tab>('qty')
  const [qtyV, setQtyV] = useState(String(line.qty))
  const [discV, setDiscV] = useState(line.lineDiscount ? String(line.lineDiscount) : '')
  const [priceV, setPriceV] = useState(String(line.unitPrice))

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gray-50 p-4">
        <p className="text-[14px] font-extrabold text-gray-900">{line.name}{line.variantName ? ` · ${line.variantName}` : ''}</p>
        <p className="text-[12px] text-gray-500 mt-0.5">{line.unit === 'kg' ? `${line.qty} kg × ${rm(line.unitPrice)}/kg` : `${line.qty} × ${rm(line.unitPrice)}`}{line.lineDiscount > 0 ? ` − ${rm(line.lineDiscount)}` : ''} = <span className="font-bold text-gray-900">{rm(lineTotal(line))}</span></p>
      </div>
      <div className="flex gap-2">
        <TabBtn active={tab === 'qty'} onClick={() => setTab('qty')} label={line.unit === 'kg' ? 'Weight' : 'Quantity'} />
        <TabBtn active={tab === 'disc'} onClick={() => setTab('disc')} label="Line discount" />
        {canEditPrice && <TabBtn active={tab === 'price'} onClick={() => setTab('price')} label="Unit price" />}
        <button type="button" onClick={() => { removeLine(line.lineId); onClose() }} className="ml-auto h-10 w-10 grid place-items-center rounded-xl bg-red-50 text-red-700" aria-label="Remove line"><Trash2 className="h-4 w-4" /></button>
      </div>
      {tab === 'qty' && (line.unit === 'kg'
        ? <WeightKeypad name={line.name} pricePerKg={line.unitPrice} initialKg={line.qty} onConfirm={kg => { setQty(line.lineId, kg); onClose() }} />
        : <PosNumpad value={qtyV} onChange={setQtyV} maxLen={4} onEnter={() => { const n = Math.round(Number(qtyV)); if (n > 0) { setQty(line.lineId, n); onClose() } }} enterLabel="Save quantity" />)}
      {tab === 'disc' && (
        <div className="space-y-2">
          <p className="text-[12px] text-gray-500">Discount in RM for this line only (max {rm(line.qty * line.unitPrice)}).</p>
          <PosNumpad value={discV} onChange={setDiscV} decimal maxLen={8} onEnter={() => { const n = Math.min(Number(discV) || 0, line.qty * line.unitPrice); setLineDiscount(line.lineId, n); onClose() }} enterLabel={discV ? `Discount ${rm(Number(discV) || 0)}` : 'No discount'} />
        </div>
      )}
      {tab === 'price' && canEditPrice && (
        <PosNumpad value={priceV} onChange={setPriceV} decimal maxLen={8} onEnter={() => { const n = Number(priceV); if (Number.isFinite(n) && n >= 0) { setUnitPrice(line.lineId, n); onClose() } }} enterLabel={`Price ${rm(Number(priceV) || 0)}${line.unit === 'kg' ? '/kg' : ''}`} />
      )}
    </div>
  )
}
