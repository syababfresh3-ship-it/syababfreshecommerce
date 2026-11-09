'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Store, DoorOpen, DoorClosed, ArrowDownToLine, ArrowUpFromLine, Printer, Loader2, RefreshCw } from 'lucide-react'
import { usePosSession } from '@/lib/stores/pos-session'
import { PosSheet } from '@/components/pos/sheet'
import { PosNumpad } from '@/components/pos/numpad'
import { PinPad } from '@/components/pos/pin-pad'
import { rm } from '@/lib/pos/money'
import { fmtKl } from '@/lib/pos/receipt'
import { POS_DECLARE_HINT, POS_DECLARE_METHODS, POS_PAY_LABEL, type PosPayMethod } from '@/lib/pos/types'
import type { PosShiftRow, PosShiftSummary } from '@/lib/pos/shifts'

// Buka / tutup kedai (shift) untuk register peranti ini.
//  Tutup → borang modal tunai (float lalai dari tetapan) → Open store.
//  Buka  → ringkasan langsung (X): jualan, tunai dijangka dalam laci; tunai masuk/keluar; cetak X; Close store
//          (isytihar SEMUA jenis bayaran: tunai dikira + jumlah QR / kad / e-wallet dari app bank & slip settlement
//           → beza per jenis → Z dibekukan + cetak).
// Tindakan perlu PIN kasyer (staf bertugas, mana-mana peranan) atau admin. UI Bahasa Inggeris.

interface Data { shift: PosShiftRow | null; summary?: PosShiftSummary; last?: PosShiftRow | null }
type Pending = null | 'open' | 'cash' | 'close'
const toNum = (s: string) => { const n = Number(s); return Number.isFinite(n) ? n : NaN }

export function ShiftClient() {
  const { registerId, registerCode, cashier, isAdmin, settings, setShift } = usePosSession()
  const [data, setData] = useState<Data | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [float, setFloat] = useState('')
  const [floatSeeded, setFloatSeeded] = useState(false)
  const [sheet, setSheet] = useState<null | 'in' | 'out' | 'close' | 'pin'>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [counted, setCounted] = useState('')
  const [decl, setDecl] = useState<Record<string, string>>({})   // jumlah diisytihar per kaedah bukan tunai
  const [field, setField] = useState<string>('cash')             // medan aktif untuk numpad dalam sheet tutup
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<Pending>(null)
  const [cashType, setCashType] = useState<'in' | 'out'>('in')
  const [busy, setBusy] = useState(false)
  const [justClosed, setJustClosed] = useState<PosShiftRow | null>(null)

  // Float lalai dari tetapan — sekali, bila tetapan tiba (corak adjust-state-during-render)
  if (!floatSeeded && settings) { setFloatSeeded(true); setFloat(String(settings.defaultFloat ?? 0)) }

  const key = `${registerId ?? ''}|${tick}`
  const loading = !!registerId && loadedKey !== key
  useEffect(() => {
    if (!registerId) return
    let alive = true
    fetch(`/api/pos/shifts?register=${registerId}`, { cache: 'no-store' }).then(r => r.json()).then((j: Data & { error?: string }) => {
      if (!alive) return
      if (j.error) toast.error(j.error)
      setData({ shift: j.shift ?? null, summary: j.summary, last: j.last ?? null })
      setShift(j.shift ? { id: j.shift.id, opened_at: j.shift.opened_at, opening_float: Number(j.shift.opening_float), opened_by_name: j.shift.opener?.name ?? null } : null)
      setLoadedKey(key)
    }).catch(() => { if (alive) { toast.error('Failed to load shift'); setLoadedKey(key) } })
    return () => { alive = false }
  }, [registerId, key, setShift])

  const needPin = !cashier && !isAdmin
  // Kaedah bukan tunai yang ada jualan dalam shift ini → wajib diisytihar semasa tutup
  const tenderMethods = POS_DECLARE_METHODS.filter(m => (data?.summary?.byMethod[m]?.amount ?? 0) > 0)
  const declaredBody = () => Object.fromEntries(tenderMethods.map(m => [m, toNum(decl[m] ?? '')]))
  const call = async (url: string, body: unknown): Promise<{ ok: boolean; pin?: boolean; j: { shift?: PosShiftRow; summary?: PosShiftSummary; error?: string; code?: string } }> => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => ({}))
    return { ok: res.ok, pin: res.status === 401 && j.code === 'PIN_REQUIRED', j }
  }

  const doOpen = async () => {
    if (!registerId) return
    const f = toNum(float === '' ? '0' : float)
    if (Number.isNaN(f) || f < 0) { toast.error('Enter a valid opening float'); return }
    if (needPin) { setPending('open'); setSheet('pin'); return }
    setBusy(true)
    try {
      const r = await call('/api/pos/shifts', { register_id: registerId, opening_float: f })
      if (r.pin) { setPending('open'); setSheet('pin'); return }
      if (!r.ok) { toast.error(r.j.error ?? 'Failed to open'); setTick(t => t + 1); return }
      toast.success(`Store opened — float ${rm(f)}`)
      setJustClosed(null); setTick(t => t + 1)
    } finally { setBusy(false) }
  }
  const doCash = async () => {
    const shift = data?.shift; if (!shift) return
    const a = toNum(amount)
    if (Number.isNaN(a) || a <= 0) { toast.error('Enter an amount'); return }
    if (!reason.trim()) { toast.error('Enter a reason'); return }
    if (needPin) { setPending('cash'); setSheet('pin'); return }
    setBusy(true)
    try {
      const r = await call(`/api/pos/shifts/${shift.id}/cash`, { type: cashType, amount: a, reason })
      if (r.pin) { setPending('cash'); setSheet('pin'); return }
      if (!r.ok) { toast.error(r.j.error ?? 'Failed'); return }
      toast.success(`${cashType === 'in' ? 'Cash in' : 'Cash out'} ${rm(a)} recorded`)
      setSheet(null); setAmount(''); setReason(''); setTick(t => t + 1)
    } finally { setBusy(false) }
  }
  const doClose = async () => {
    const shift = data?.shift; if (!shift) return
    const c = toNum(counted)
    if (counted === '' || Number.isNaN(c) || c < 0) { setField('cash'); toast.error('Enter the cash counted in the drawer'); return }
    for (const m of tenderMethods) { const d = toNum(decl[m] ?? ''); if ((decl[m] ?? '') === '' || Number.isNaN(d) || d < 0) { setField(m); toast.error(`Enter the ${POS_PAY_LABEL[m]} total`); return } }
    if (needPin) { setPending('close'); setSheet('pin'); return }
    setBusy(true)
    try {
      const r = await call(`/api/pos/shifts/${shift.id}/close`, { counted_cash: c, declared: declaredBody(), note })
      if (r.pin) { setPending('close'); setSheet('pin'); return }
      if (!r.ok || !r.j.shift) { toast.error(r.j.error ?? 'Failed to close'); return }
      toast.success('Store closed')
      setJustClosed(r.j.shift); setSheet(null); setCounted(''); setNote(''); setTick(t => t + 1)
    } finally { setBusy(false) }
  }
  const afterPin = () => {
    const p = pending; setPending(null)
    setSheet(p === 'cash' ? cashType : p === 'close' ? 'close' : null)
    // kuki PIN dah diset; jalankan semula tindakan selepas state kasyer dikemas kini
    setTimeout(() => { if (p === 'open') void doOpenAfterPin(); else if (p === 'cash') void doCashAfterPin(); else if (p === 'close') void doCloseAfterPin() }, 60)
  }
  // Versi selepas PIN: sama seperti di atas tetapi tanpa semakan needPin (state kasyer mungkin belum sampai ke closure)
  const doOpenAfterPin = async () => { if (!registerId) return; setBusy(true); try { const f = toNum(float === '' ? '0' : float); const r = await call('/api/pos/shifts', { register_id: registerId, opening_float: f }); if (!r.ok) { toast.error(r.j.error ?? 'Failed to open'); return } toast.success(`Store opened — float ${rm(f)}`); setJustClosed(null); setTick(t => t + 1) } finally { setBusy(false) } }
  const doCashAfterPin = async () => { const shift = data?.shift; if (!shift) return; setBusy(true); try { const a = toNum(amount); const r = await call(`/api/pos/shifts/${shift.id}/cash`, { type: cashType, amount: a, reason }); if (!r.ok) { toast.error(r.j.error ?? 'Failed'); return } toast.success(`${cashType === 'in' ? 'Cash in' : 'Cash out'} ${rm(a)} recorded`); setSheet(null); setAmount(''); setReason(''); setTick(t => t + 1) } finally { setBusy(false) } }
  const doCloseAfterPin = async () => { const shift = data?.shift; if (!shift) return; setBusy(true); try { const r = await call(`/api/pos/shifts/${shift.id}/close`, { counted_cash: toNum(counted), declared: declaredBody(), note }); if (!r.ok || !r.j.shift) { toast.error(r.j.error ?? 'Failed to close'); return } toast.success('Store closed'); setJustClosed(r.j.shift); setSheet(null); setCounted(''); setNote(''); setTick(t => t + 1) } finally { setBusy(false) } }

  if (!registerId) return <div className="p-6 text-center text-[14px] text-gray-500">Select this device&apos;s register in <Link href="/pos/settings" className="underline font-semibold">Settings</Link> first.</div>

  const shift = data?.shift ?? null
  const sum = data?.summary
  const countedN = toNum(counted)
  const variance = sum && counted !== '' && !Number.isNaN(countedN) ? Math.round((countedN - sum.expectedCash) * 100) / 100 : null
  const fieldValue = field === 'cash' ? counted : (decl[field] ?? '')
  const setFieldValue = (v: string) => { if (field === 'cash') setCounted(v); else setDecl(d => ({ ...d, [field]: v })) }
  const allEntered = counted !== '' && tenderMethods.every(m => (decl[m] ?? '') !== '')

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-5xl w-full mx-auto space-y-5 lg:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] lg:text-[28px] font-black inline-flex items-center gap-2"><Store className="h-6 w-6 lg:h-7 lg:w-7" /> Store · {registerCode}</h1>
          <p className="text-[14px] lg:text-[17px] text-gray-500">{loading && !data ? 'Loading…' : shift ? <>Open since <span className="font-bold text-gray-900">{fmtKl(shift.opened_at)}</span>{shift.opener?.name ? ` · ${shift.opener.name}` : ''}</> : 'Closed'}</p>
        </div>
        <button type="button" onClick={() => setTick(t => t + 1)} aria-label="Refresh" className="h-12 w-12 lg:h-14 lg:w-14 grid place-items-center rounded-2xl bg-white border border-gray-200 text-gray-600"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {loading && !data && <p className="text-center text-gray-400 py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></p>}

      {/* Baru ditutup: ringkasan Z */}
      {justClosed && justClosed.summary && (
        <section className="rounded-2xl bg-white border border-gray-900 p-4 space-y-3">
          <h2 className="text-[17px] lg:text-[22px] font-extrabold inline-flex items-center gap-2"><DoorClosed className="h-5 w-5" /> Store closed — Z report</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            <Stat label="Sales" value={String(justClosed.summary.sales)} />
            <Stat label="Revenue" value={rm(justClosed.summary.revenue)} />
            <Stat label="Expected cash" value={rm(justClosed.expected_cash ?? 0)} />
            <Stat label="Counted" value={rm(justClosed.counted_cash ?? 0)} sub={(justClosed.variance ?? 0) === 0 ? 'exact' : `${(justClosed.variance ?? 0) > 0 ? 'over' : 'short'} ${rm(Math.abs(justClosed.variance ?? 0))}`} warn={(justClosed.variance ?? 0) !== 0} />
          </div>
          {POS_DECLARE_METHODS.filter(m => justClosed.summary?.declared?.[m] != null).length > 0 && (
            <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 text-[14px] lg:text-[16px]">
              {POS_DECLARE_METHODS.filter(m => justClosed.summary?.declared?.[m] != null).map(m => {
                const d = justClosed.summary?.tenderVariance?.[m] ?? 0
                return <div key={m} className="flex justify-between px-3 py-2"><span className="text-gray-700">{POS_PAY_LABEL[m]} declared {rm(justClosed.summary?.declared?.[m] ?? 0)}</span><span className={`font-bold ${d === 0 ? 'text-gray-600' : 'text-amber-700'}`}>{d === 0 ? 'Exact' : `${d > 0 ? 'Over' : 'Short'} ${rm(Math.abs(d))}`}</span></div>
              })}
            </div>
          )}
          <button type="button" onClick={() => window.open(`/pos/shift-report/${justClosed.id}?print=1`, '_blank', 'noopener')} className="w-full h-14 lg:h-16 rounded-2xl bg-gray-900 text-white text-[16px] lg:text-[18px] font-extrabold inline-flex items-center justify-center gap-2"><Printer className="h-5 w-5" /> Print Z report</button>
        </section>
      )}

      {/* Kedai tutup → buka */}
      {data && !shift && (
        <section className="rounded-2xl bg-white border border-gray-200 p-4 lg:p-8 space-y-4 lg:space-y-6">
          <div>
            <h2 className="text-[18px] lg:text-[24px] font-extrabold inline-flex items-center gap-2"><DoorOpen className="h-5 w-5 lg:h-6 lg:w-6" /> Open store</h2>
            <p className="text-[14px] lg:text-[16px] text-gray-500">Count the cash you are starting with in the drawer (the float), enter it, then open. Selling is locked until the store is open.</p>
          </div>
          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 text-center">
            <p className="text-[13px] lg:text-[15px] font-semibold text-gray-500">Opening cash float</p>
            <p className="text-[44px] lg:text-[64px] font-black tabular-nums leading-tight">RM{float === '' ? '0' : float}</p>
          </div>
          <div className="max-w-md mx-auto w-full"><PosNumpad value={float} onChange={setFloat} decimal maxLen={8} onEnter={doOpen} enterLabel={busy ? 'Opening…' : 'Open store'} disabled={busy} size="lg" /></div>
          {data.last && !justClosed && <p className="text-[13px] lg:text-[14px] text-gray-500 text-center">Last closed {data.last.closed_at ? fmtKl(data.last.closed_at) : ''} · counted {rm(data.last.counted_cash ?? 0)}{(data.last.variance ?? 0) !== 0 ? ` · ${(data.last.variance ?? 0) > 0 ? 'over' : 'short'} ${rm(Math.abs(data.last.variance ?? 0))}` : ''} · <button type="button" className="underline" onClick={() => window.open(`/pos/shift-report/${data.last!.id}`, '_blank', 'noopener')}>view Z</button></p>}
        </section>
      )}

      {/* Kedai buka → ringkasan langsung */}
      {shift && sum && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            <Stat label="Sales" value={String(sum.sales)} sub={`${sum.voids} void · ${sum.pending} pending`} />
            <Stat label="Revenue" value={rm(sum.revenue)} sub={`discount ${rm(sum.discount)}`} />
            <Stat label="Opening float" value={rm(sum.openingFloat)} />
            <Stat label="Expected in drawer" value={rm(sum.expectedCash)} sub={`cash sales ${rm(sum.cashSales)}`} strong />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
            <section className="rounded-2xl bg-white border border-gray-200 p-4 lg:p-6 min-h-[140px]">
              <h2 className="text-[15px] lg:text-[18px] font-extrabold mb-2">By payment method</h2>
              <div className="divide-y divide-gray-100 text-[14px] lg:text-[17px]">
                {(Object.entries(sum.byMethod) as [PosPayMethod, { count: number; amount: number }][]).map(([m, v]) => <div key={m} className="flex justify-between py-2 lg:py-2.5"><span className="text-gray-700">{POS_PAY_LABEL[m]} ({v.count})</span><span className="font-bold tabular-nums">{rm(v.amount)}</span></div>)}
                {Object.keys(sum.byMethod).length === 0 && <p className="py-2 text-gray-400">No sales yet.</p>}
              </div>
            </section>
            <section className="rounded-2xl bg-white border border-gray-200 p-4 lg:p-6 min-h-[140px]">
              <h2 className="text-[15px] lg:text-[18px] font-extrabold mb-2">Cash in / out</h2>
              <div className="divide-y divide-gray-100 text-[14px] lg:text-[17px]">
                {sum.movements.map(m => <div key={m.id} className="flex justify-between gap-2 py-2 lg:py-2.5"><span className="text-gray-700 min-w-0 truncate">{m.type === 'in' ? 'In' : 'Out'} · {m.reason ?? '—'}{m.cashier ? ` · ${m.cashier}` : ''}</span><span className={`font-bold tabular-nums ${m.type === 'out' ? 'text-red-700' : ''}`}>{m.type === 'out' ? '−' : '+'}{rm(m.amount)}</span></div>)}
                {sum.movements.length === 0 && <p className="py-2 text-gray-400">None.</p>}
              </div>
            </section>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-4">
            <button type="button" onClick={() => { setCashType('in'); setAmount(''); setReason(''); setSheet('in') }} className="h-16 lg:h-20 rounded-2xl bg-white border border-gray-200 text-[15px] lg:text-[19px] font-extrabold inline-flex items-center justify-center gap-2"><ArrowDownToLine className="h-5 w-5 lg:h-6 lg:w-6" /> Cash in</button>
            <button type="button" onClick={() => { setCashType('out'); setAmount(''); setReason(''); setSheet('out') }} className="h-16 lg:h-20 rounded-2xl bg-white border border-gray-200 text-[15px] lg:text-[19px] font-extrabold inline-flex items-center justify-center gap-2"><ArrowUpFromLine className="h-5 w-5 lg:h-6 lg:w-6" /> Cash out</button>
            <button type="button" onClick={() => window.open(`/pos/shift-report/${shift.id}?print=1`, '_blank', 'noopener')} className="h-16 lg:h-20 rounded-2xl bg-white border border-gray-200 text-[15px] lg:text-[19px] font-extrabold inline-flex items-center justify-center gap-2"><Printer className="h-5 w-5 lg:h-6 lg:w-6" /> X report</button>
            <button type="button" onClick={() => { setCounted(''); setDecl({}); setField('cash'); setNote(''); setSheet('close') }} className="h-16 lg:h-20 rounded-2xl text-white text-[15px] lg:text-[19px] font-extrabold inline-flex items-center justify-center gap-2" style={{ background: '#E11D2A' }}><DoorClosed className="h-5 w-5 lg:h-6 lg:w-6" /> Close store</button>
          </div>
        </>
      )}

      {/* Tunai masuk / keluar */}
      <PosSheet open={sheet === 'in' || sheet === 'out'} onClose={() => setSheet(null)} title={cashType === 'in' ? 'Cash in (add to drawer)' : 'Cash out (take from drawer)'}>
        <div className="space-y-3">
          <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 text-center"><p className="text-[13px] font-semibold text-gray-500">Amount</p><p className="text-[40px] lg:text-[48px] font-black tabular-nums leading-tight">RM{amount === '' ? '0' : amount}</p></div>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder={cashType === 'in' ? 'Reason — e.g. extra change from HQ' : 'Reason — e.g. bought ice, petty cash'} className="w-full h-14 px-4 rounded-xl border border-gray-300 text-[16px]" />
          <PosNumpad value={amount} onChange={setAmount} decimal maxLen={8} onEnter={doCash} enterLabel={busy ? 'Saving…' : 'Save'} disabled={busy} size="lg" />
        </div>
      </PosSheet>

      {/* Tutup kedai — isytihar semua jenis bayaran */}
      <PosSheet open={sheet === 'close'} onClose={() => setSheet(null)} title="Close store — declare all payments" wide>
        <div className="space-y-3">
          <p className="text-[14px] lg:text-[15px] text-gray-500">Tap each line and enter the real total: cash counted in the drawer (including the float){tenderMethods.length > 0 ? ', and the totals from the bank app / terminal settlement slips' : ''}.</p>
          <div className="space-y-2">
            <TenderRow label="Cash counted in drawer" hint="All notes and coins, including the float" value={counted} active={field === 'cash'} onSelect={() => setField('cash')}
              expected={sum ? sum.expectedCash : null} diff={variance} />
            {tenderMethods.map(m => {
              const v = decl[m] ?? ''
              const exp = sum?.byMethod[m]?.amount ?? 0
              const d = v !== '' && !Number.isNaN(toNum(v)) ? Math.round((toNum(v) - exp) * 100) / 100 : null
              return <TenderRow key={m} label={POS_PAY_LABEL[m]} hint={`${POS_DECLARE_HINT[m] ?? ''} · ${sum?.byMethod[m]?.count ?? 0} sales`} value={v} active={field === m} onSelect={() => setField(m)} expected={exp} diff={d} />
            })}
          </div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional) — e.g. RM5 short, gave wrong change" className="w-full h-14 px-4 rounded-xl border border-gray-300 text-[16px]" />
          <div className="max-w-md mx-auto w-full"><PosNumpad value={fieldValue} onChange={setFieldValue} decimal maxLen={9} size="lg" onEnter={doClose} enterLabel={busy ? 'Closing…' : allEntered ? 'Close store' : 'Enter all totals to close'} disabled={busy} /></div>
        </div>
      </PosSheet>

      <PosSheet open={sheet === 'pin'} onClose={() => { setSheet(null); setPending(null) }} title="Enter your PIN to continue"><PinPad onDone={afterPin} /></PosSheet>
    </div>
  )
}

/** Satu baris isytihar dalam sheet tutup: ketuk untuk jadikan medan aktif numpad; beza dipapar selepas diisi. */
function TenderRow({ label, hint, value, active, onSelect, expected, diff }: { label: string; hint: string; value: string; active: boolean; onSelect: () => void; expected: number | null; diff: number | null }) {
  return (
    <button type="button" onClick={onSelect} className={`w-full text-left rounded-2xl border px-4 py-3.5 lg:py-4 flex items-center gap-3 ${active ? 'border-gray-900 ring-2 ring-gray-900 bg-white' : 'border-gray-200 bg-white'}`}>
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] lg:text-[18px] font-extrabold">{label}</span>
        <span className="block text-[13px] lg:text-[14px] text-gray-500 truncate">{hint}</span>
        {diff !== null && expected !== null && <span className={`block text-[13px] lg:text-[15px] font-bold ${diff === 0 ? 'text-gray-600' : 'text-amber-700'}`}>System {rm(expected)} · {diff === 0 ? 'Exact' : `${diff > 0 ? 'Over' : 'Short'} ${rm(Math.abs(diff))}`}</span>}
      </span>
      <span className={`text-[26px] lg:text-[32px] font-black tabular-nums ${value === '' ? 'text-gray-300' : 'text-gray-900'}`}>RM{value === '' ? '0' : value}</span>
    </button>
  )
}

function Stat({ label, value, sub, strong, warn }: { label: string; value: string; sub?: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 lg:p-6 ${strong ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200'}`}>
      <p className={`text-[12px] lg:text-[15px] font-semibold ${strong ? 'text-white/70' : 'text-gray-500'}`}>{label}</p>
      <p className="text-[24px] lg:text-[36px] font-black tabular-nums leading-tight">{value}</p>
      {sub && <p className={`text-[12px] lg:text-[14px] mt-0.5 lg:mt-1 ${warn ? 'font-bold text-amber-700' : strong ? 'text-white/70' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}
