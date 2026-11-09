'use client'

import { useState } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { PosNumpad } from '@/components/pos/numpad'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { lineTotal, rm } from '@/lib/pos/money'

// Sheet kecil: tiket tangguh (hold/recall) & item manual (nama + harga, bukan dari katalog).

export function HeldSheet({ onClose }: { onClose: () => void }) {
  const { held, recall, dropHeld, lines, hold } = usePosTicket()
  return (
    <div className="space-y-3">
      {lines.length > 0 && (
        <button type="button" onClick={() => { hold(); onClose() }} className="w-full h-12 rounded-2xl bg-gray-900 text-white text-[14px] font-extrabold">Hold current ticket ({lines.length} items)</button>
      )}
      {held.length === 0 ? <p className="text-[13px] text-gray-400 text-center py-6">No held tickets.</p> : (
        <ul className="space-y-2">
          {held.map(h => (
            <li key={h.id} className="rounded-2xl border border-gray-200 p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold truncate">{h.label}</p>
                <p className="text-[12px] text-gray-500 inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(h.heldAt).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })} · {h.lines.length} items · {rm(h.lines.reduce((s, l) => s + lineTotal(l), 0))}</p>
              </div>
              <button type="button" onClick={() => { recall(h.id); onClose() }} className="h-10 px-3 rounded-xl bg-gray-900 text-white text-[12px] font-bold">Resume</button>
              <button type="button" onClick={() => dropHeld(h.id)} aria-label="Discard" className="h-10 w-10 grid place-items-center rounded-xl bg-red-50 text-red-700"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CustomItemSheet({ onClose }: { onClose: () => void }) {
  const { addCustom } = usePosTicket()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const n = Number(price) || 0
  return (
    <div className="space-y-3">
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Item name (e.g. Paper bag)" className="w-full h-12 px-4 rounded-2xl border border-gray-300 text-[15px] font-semibold" />
      <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[30px] leading-none font-black tabular-nums">{rm(n)}</p></div>
      <PosNumpad value={price} onChange={setPrice} decimal maxLen={8} onEnter={() => { if (name.trim() && n >= 0) { addCustom(name.trim(), n, 1); onClose() } }} enterLabel="Add item" disabled={!name.trim()} />
    </div>
  )
}
