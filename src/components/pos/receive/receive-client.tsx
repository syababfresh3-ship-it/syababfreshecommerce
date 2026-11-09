'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { PackageCheck, Loader2, RefreshCw, Boxes } from 'lucide-react'
import { usePosSession } from '@/lib/stores/pos-session'
import { PosSheet } from '@/components/pos/sheet'
import { PinPad } from '@/components/pos/pin-pad'
import { fmtQty } from '@/lib/pos/money'
import { fmtKl } from '@/lib/pos/receipt'
import type { OutletStockRow, TransferRow } from '@/lib/pos/outlets'

// Receive (peranti outlet, migration 157): DO yang dikeluarkan HQ untuk outlet register ini → staf bertugas
// sahkan kuantiti diterima (lalai = dihantar; beza direkod sebagai pelarasan) → stok outlet dikemas kini.
// Juga papar stok outlet semasa. Perlu PIN kasyer (mana-mana peranan) atau admin. UI Bahasa Inggeris.

interface Data { outlet: { id: string; code: string; name: string; type: string } | null; pending: TransferRow[]; recent: TransferRow[] }
const qtyStr = (q: number, unit: string) => unit === 'kg' ? `${Number(q).toFixed(3).replace(/\.?0+$/, '')} kg` : unit === 'ctn' ? `${Number(q)} ctn` : `${Number(q)} pcs`

export function ReceiveClient() {
  const { registerId, cashier, isAdmin } = usePosSession()
  const [data, setData] = useState<Data | null>(null)
  const [stock, setStock] = useState<OutletStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<TransferRow | null>(null)
  const [received, setReceived] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [pinOpen, setPinOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!registerId) { setLoading(false); return }
    setLoading(true)
    try {
      const [t, s] = await Promise.all([
        fetch(`/api/pos/transfers?register=${registerId}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/pos/outlet-stock?register=${registerId}`, { cache: 'no-store' }).then(r => r.json()),
      ])
      setData({ outlet: t.outlet ?? null, pending: t.pending ?? [], recent: t.recent ?? [] })
      setStock(s.rows ?? [])
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }, [registerId])
  useEffect(() => { load() }, [load])

  const openTransfer = (t: TransferRow) => {
    setSel(t); setNote('')
    setReceived(Object.fromEntries((t.pos_transfer_items ?? []).map(i => [i.id, String(Number(i.base_qty))])))
  }
  const confirm = async () => {
    if (!sel) return
    if (!cashier && !isAdmin) { setPinOpen(true); return }
    const items = (sel.pos_transfer_items ?? []).map(i => ({ id: i.id, received_qty: Number(received[i.id] ?? i.base_qty) }))
    if (items.some(i => !Number.isFinite(i.received_qty) || i.received_qty < 0)) { toast.error('Check the received quantities'); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/pos/transfers/${sel.id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, note }) })
      const j = await res.json().catch(() => ({}))
      if (res.status === 401 && j.code === 'PIN_REQUIRED') { setPinOpen(true); return }
      if (!res.ok) throw new Error(j.error ?? 'Failed')
      toast.success(`${sel.doc_no} confirmed — stock updated`)
      setSel(null); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  if (!registerId) return <div className="p-6 text-center text-[14px] text-gray-500">Select this device&apos;s register in <Link href="/pos/settings" className="underline font-semibold">Settings</Link> first.</div>

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-3xl w-full mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-[18px] font-black inline-flex items-center gap-2"><PackageCheck className="h-5 w-5" /> Receive stock</h1>
          <p className="text-[13px] text-gray-500">{data?.outlet ? <>Outlet <span className="font-bold text-gray-900">{data.outlet.code} · {data.outlet.name}</span></> : loading ? 'Loading…' : 'This register is not assigned to an outlet yet (Admin → POS → Cashiers & Access → register Edit).'}</p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh" className="h-11 w-11 grid place-items-center rounded-2xl bg-white border border-gray-200 text-gray-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      <section className="space-y-2">
        <h2 className="text-[14px] font-extrabold">Awaiting confirmation</h2>
        {loading && !data && <p className="text-center text-gray-400 py-6"><Loader2 className="h-5 w-5 animate-spin inline" /></p>}
        {data && data.pending.length === 0 && <p className="rounded-2xl bg-white border border-gray-200 p-4 text-[13px] text-gray-500">No delivery orders waiting. When HQ issues a DO for this outlet it appears here.</p>}
        {data?.pending.map(t => (
          <button key={t.id} type="button" onClick={() => openTransfer(t)} className="w-full text-left rounded-2xl bg-white border border-gray-200 p-4 hover:border-gray-400 active:bg-gray-50">
            <div className="flex items-center justify-between"><span className="text-[16px] font-black">{t.doc_no}</span><span className="text-[12px] font-bold px-2 h-6 grid place-items-center rounded-full bg-gray-900 text-white">{(t.pos_transfer_items ?? []).length} lines</span></div>
            <p className="text-[13px] text-gray-500">From {t.from_outlet?.name ?? t.from_outlet?.code} · issued {t.issued_at ? fmtKl(t.issued_at) : ''}{t.note ? ` · ${t.note}` : ''}</p>
          </button>
        ))}
      </section>

      {data?.outlet && data.outlet.type !== 'hq' && (
        <section className="space-y-2">
          <h2 className="text-[14px] font-extrabold inline-flex items-center gap-2"><Boxes className="h-4 w-4" /> Stock at this outlet</h2>
          <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden">
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-gray-100">
                {stock.map(r => <tr key={r.id} className={r.qty <= 0 ? 'text-gray-400' : ''}><td className="px-4 py-2">{r.name}{r.variant_name && <span className="text-gray-500"> · {r.variant_name}</span>}</td><td className="px-4 py-2 text-right font-bold tabular-nums">{fmtQty(r.qty, r.unit)}</td></tr>)}
                {stock.length === 0 && <tr><td className="px-4 py-6 text-center text-gray-400">No stock recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && data.recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[14px] font-extrabold">Confirmed recently</h2>
          {data.recent.map(t => <div key={t.id} className="rounded-2xl bg-white border border-gray-200 px-4 py-3 text-[13px] flex items-center justify-between"><span className="font-bold">{t.doc_no}</span><span className="text-gray-500">{t.confirmed_at ? fmtKl(t.confirmed_at) : ''}{t.confirmed_cashier?.name ? ` · ${t.confirmed_cashier.name}` : ''}</span></div>)}
        </section>
      )}

      <PosSheet open={!!sel} onClose={() => setSel(null)} title={sel ? `Confirm ${sel.doc_no}` : ''} wide>
        {sel && (
          <div className="space-y-3">
            <p className="text-[13px] text-gray-500">Check each line against what arrived. Change the number only if it differs — the difference is recorded as a stock adjustment.</p>
            <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
              {(sel.pos_transfer_items ?? []).map(i => (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0"><p className="text-[14px] font-bold truncate">{i.name}{i.variant_name ? <span className="text-gray-500 font-normal"> · {i.variant_name}</span> : null}</p><p className="text-[12px] text-gray-500">Sent {qtyStr(Number(i.qty), i.unit)}{i.unit === 'ctn' && i.pack_size ? ` × ${Number(i.pack_size)} = ${qtyStr(Number(i.base_qty), i.base_unit)}` : ''}</p></div>
                  <div className="flex items-center gap-1"><input value={received[i.id] ?? ''} onChange={e => setReceived(r => ({ ...r, [i.id]: e.target.value }))} inputMode="decimal" className={`h-12 w-24 px-2 rounded-xl border text-[16px] font-bold tabular-nums text-right ${Number(received[i.id]) !== Number(i.base_qty) ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`} /><span className="text-[12px] text-gray-500 w-7">{i.base_unit}</span></div>
                </div>
              ))}
            </div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional) — e.g. 1 carton damaged" className="w-full h-12 px-3 rounded-xl border border-gray-300 text-[14px]" />
            <button type="button" onClick={confirm} disabled={busy} className="w-full h-14 rounded-2xl text-white text-[16px] font-extrabold disabled:opacity-50" style={{ background: '#E11D2A' }}>{busy ? 'Saving…' : cashier || isAdmin ? `Confirm received${cashier ? ` as ${cashier.name}` : ''}` : 'Enter PIN & confirm'}</button>
          </div>
        )}
      </PosSheet>
      <PosSheet open={pinOpen} onClose={() => setPinOpen(false)} title="Enter your PIN to confirm"><PinPad onDone={() => { setPinOpen(false); setTimeout(() => { void confirm() }, 50) }} /></PosSheet>
    </div>
  )
}
