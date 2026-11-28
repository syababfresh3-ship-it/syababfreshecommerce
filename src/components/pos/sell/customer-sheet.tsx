'use client'

import { useEffect, useState } from 'react'
import { Coins, Store, UserRound, X } from 'lucide-react'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { usePosSession } from '@/lib/stores/pos-session'
import { normalizePhone } from '@/lib/phone'
import { memberInviteLink } from '@/lib/pos/member-invite'

// Pelanggan pilihan pada tiket: NAMA sahaja pun boleh (walk-in — nama tertera pada resit & senarai jualan),
// atau telefon (+ nama) → pelanggan dicipta/dikemas kini di CRM selepas jualan (upsertCustomer sumber 'pos')
// dan e-resit WhatsApp dipra-isi. Cari CRM ikut telefon (≥3 digit) atau nama (≥3 huruf).
// Sebelum 9 Nov: butang simpan hanya hidup bila telefon sah, dan medan pertama papan kekunci nombor —
// nama sahaja tak boleh disimpan (pepijat dilaporkan pemilik).
// Mata loyalty (migration 169): hit bawa member/points/pending_points; pilih hit → tiket tahu ahli & baki (untuk tebus).
interface Hit { id: string; name: string | null; phone_norm: string; order_count: number | null; total_spend: number | null; is_reseller?: boolean | null; member?: boolean; member_user_id?: string | null; points?: number; pending_points?: number; multiplier?: number }
const fmtPts = (n: number) => `${Math.floor(n).toLocaleString('en-MY')} pts`

export function CustomerSheet({ onClose }: { onClose: () => void }) {
  const { customer, setCustomer, wholesale, setWholesale } = usePosTicket()
  // Tiket Borong (171): tick manual atau automatik bila pelanggan CRM ditanda Borong; hanya bila senarai harga borong ditetapkan
  const wholesaleEnabled = !!usePosSession(s => s.settings?.wholesalePriceListId)
  const [borong, setBorong] = useState(wholesale)
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
    // nombor ditaip penuh & padan hit ahli → bawa status ahli walaupun kasyer tak tekan hit itu
    const m = norm ? hits.find(h => h.phone_norm === norm && h.member) : null
    setCustomer({ phone: norm || '', name: nq || m?.name || null, id: m && !m.id.startsWith('member:') ? m.id : null, memberUserId: m?.member_user_id ?? null, points: m?.points ?? null, pendingPoints: m?.pending_points ?? null, multiplier: m?.multiplier ?? null })
    if (wholesaleEnabled) setWholesale(borong)
    onClose()
  }
  const pickHit = (h: Hit) => {
    setCustomer({ phone: h.phone_norm, name: h.name, id: h.id.startsWith('member:') ? null : h.id, memberUserId: h.member_user_id ?? null, points: h.points ?? null, pendingPoints: h.pending_points ?? null, multiplier: h.multiplier ?? null })
    if (wholesaleEnabled) setWholesale(borong || !!h.is_reseller)   // pelanggan CRM Borong → harga borong automatik
    onClose()
  }

  return (
    <div className="space-y-3">
      {customer && (
        <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-3">
          <div className="min-w-0"><p className="text-[14px] font-bold truncate">{customer.name ?? 'Customer'}</p><p className="text-[12px] text-gray-500">{customer.phone || 'no phone'}{customer.memberUserId ? ` · Member · ${fmtPts(customer.points ?? 0)}` : customer.pendingPoints ? ` · ${fmtPts(customer.pendingPoints)} pending` : ''}</p></div>
          <div className="flex items-center shrink-0">
          {!customer.memberUserId && customer.phone && (
            <a href={memberInviteLink(customer.phone, customer.pendingPoints ?? 0, customer.name)} target="_blank" rel="noopener noreferrer" className="h-10 px-3 rounded-xl bg-white border border-gray-200 text-[12px] font-bold inline-flex items-center gap-1 mr-2"><Coins className="h-3.5 w-3.5" /> Invite to register</a>
          )}
          <button type="button" onClick={() => { setCustomer(null); setWholesale(false); onClose() }} className="h-10 px-3 rounded-xl bg-white border border-gray-200 text-[12px] font-bold inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Remove</button>
          </div>
        </div>
      )}
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" autoComplete="off" className="w-full h-14 px-4 rounded-2xl border border-gray-300 text-[17px] font-semibold" />
      <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number (optional)" autoComplete="off" className={`w-full h-14 px-4 rounded-2xl border text-[17px] font-semibold ${phoneBad ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`} />
      {phoneBad && <p className="text-[12px] font-semibold text-amber-800">That does not look like a Malaysian phone number — fix it or clear it to save the name only.</p>}
      {wholesaleEnabled && (
        <label className={`flex items-center gap-3 rounded-2xl border px-4 h-14 cursor-pointer ${borong ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white'}`}>
          <input type="checkbox" checked={borong} onChange={e => setBorong(e.target.checked)} className="h-5 w-5 accent-gray-800" />
          <span className="text-[15px] font-extrabold inline-flex items-center gap-1.5"><Store className="h-4 w-4" /> Wholesale prices</span>
          <span className={`ml-auto text-[11px] font-semibold ${borong ? 'text-gray-300' : 'text-gray-400'}`}>Ticks itself for CRM wholesale customers</span>
        </label>
      )}
      {visible.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 overflow-hidden">
          {visible.map(h => (
            <li key={h.id}>
              <button type="button" onClick={() => pickHit(h)} className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-gray-50">
                {h.member ? <Coins className="h-4 w-4 text-gray-700 shrink-0" /> : <UserRound className="h-4 w-4 text-gray-400 shrink-0" />}
                <div className="min-w-0 flex-1"><p className="text-[14px] font-bold truncate">{h.name ?? '(no name)'}</p><p className="text-[12px] text-gray-500">{h.phone_norm}{h.order_count ? ` · ${h.order_count} orders` : ''}{h.is_reseller ? ' · Wholesale' : ''}</p></div>
                {h.member
                  ? <span className="shrink-0 text-right"><span className="block text-[13px] font-black tabular-nums">{fmtPts(h.points ?? 0)}</span><span className="block text-[11px] text-gray-500">Member</span></span>
                  : (h.pending_points ?? 0) > 0 ? <span className="shrink-0 text-[11px] font-semibold text-gray-500 text-right">{fmtPts(h.pending_points ?? 0)}<br />pending</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searching && <p className="text-[12px] text-gray-400">Searching…</p>}
      <button type="button" onClick={save} disabled={!canSave} className="w-full h-14 rounded-2xl text-white text-[16px] font-extrabold disabled:opacity-40" style={{ background: '#111827' }}>
        {norm ? `Use ${nq ? `${nq} · ` : ''}${norm}` : nq && !phoneBad ? `Use “${nq}” (no phone)` : 'Enter a name or phone number'}
      </button>
      <p className="text-[12px] text-gray-500">A name alone is enough — it prints on the receipt and shows in Sales. Add a phone number to save the customer to your CRM and send a WhatsApp e-receipt. Members earn points on this sale; non-member points wait on their number until they register.</p>
    </div>
  )
}
