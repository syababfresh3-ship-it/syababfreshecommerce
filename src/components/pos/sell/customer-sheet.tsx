'use client'

import { useEffect, useState } from 'react'
import { UserRound, X } from 'lucide-react'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { normalizePhone } from '@/lib/phone'

// Pelanggan pilihan pada tiket: NAMA sahaja pun boleh (walk-in — nama tertera pada resit & senarai jualan),
// atau telefon (+ nama) → pelanggan dicipta/dikemas kini di CRM selepas jualan (upsertCustomer sumber 'pos')
// dan e-resit WhatsApp dipra-isi. Cari CRM ikut telefon (≥3 digit) atau nama (≥3 huruf).
// Sebelum 9 Nov: butang simpan hanya hidup bila telefon sah, dan medan pertama papan kekunci nombor —
// nama sahaja tak boleh disimpan (pepijat dilaporkan pemilik).
interface Hit { id: string; name: string | null; phone_norm: string; order_count: number | null; total_spend: number | null }

export function CustomerSheet({ onClose }: { onClose: () => void }) {
  const { customer, setCustomer } = usePosTicket()
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [hits, setHits] = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const pq = phone.trim(), nq = name.trim()
  const q = pq.length >= 3 ? pq : nq.length >= 3 ? nq : ''

  useEffect(() => {
    if (!q) return
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(q)}`)
        setHits(res.ok ? await res.json() : [])
      } catch { setHits([]) } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])
  const visible = q ? hits : []

  const norm = normalizePhone(phone)
  const phoneBad = pq !== '' && !norm          // ada isi tetapi bukan nombor Malaysia sah
  const canSave = !phoneBad && (!!norm || nq !== '')
  const save = () => {
    if (!canSave) return
    setCustomer({ phone: norm || '', name: nq || null, id: null })
    onClose()
  }

  return (
    <div className="space-y-3">
      {customer && (
        <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
          <div className="min-w-0"><p className="text-[14px] font-bold truncate">{customer.name ?? 'Customer'}</p><p className="text-[12px] text-gray-500">{customer.phone || 'no phone'}</p></div>
          <button type="button" onClick={() => { setCustomer(null); onClose() }} className="h-10 px-3 rounded-xl bg-white border border-gray-200 text-[12px] font-bold inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Remove</button>
        </div>
      )}
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" autoComplete="off" className="w-full h-14 px-4 rounded-2xl border border-gray-300 text-[17px] font-semibold" />
      <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number (optional)" autoComplete="off" className={`w-full h-14 px-4 rounded-2xl border text-[17px] font-semibold ${phoneBad ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`} />
      {phoneBad && <p className="text-[12px] font-semibold text-amber-800">That does not look like a Malaysian phone number — fix it or clear it to save the name only.</p>}
      {visible.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden">
          {visible.map(h => (
            <li key={h.id}>
              <button type="button" onClick={() => { setCustomer({ phone: h.phone_norm, name: h.name, id: h.id }); onClose() }} className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-gray-50">
                <UserRound className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="min-w-0 flex-1"><p className="text-[14px] font-bold truncate">{h.name ?? '(no name)'}</p><p className="text-[12px] text-gray-500">{h.phone_norm}{h.order_count ? ` · ${h.order_count} orders` : ''}</p></div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searching && <p className="text-[12px] text-gray-400">Searching…</p>}
      <button type="button" onClick={save} disabled={!canSave} className="w-full h-14 rounded-2xl text-white text-[16px] font-extrabold disabled:opacity-40" style={{ background: '#111827' }}>
        {norm ? `Use ${nq ? `${nq} · ` : ''}${norm}` : nq && !phoneBad ? `Use “${nq}” (no phone)` : 'Enter a name or phone number'}
      </button>
      <p className="text-[12px] text-gray-500">A name alone is enough — it prints on the receipt and shows in Sales. Add a phone number to save the customer to your CRM and send a WhatsApp e-receipt.</p>
    </div>
  )
}
