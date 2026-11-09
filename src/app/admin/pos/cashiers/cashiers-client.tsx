'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, KeyRound, Lock, UserRound, Trash2, Unlock, Pencil, Check, X } from 'lucide-react'

// Tiga bahagian: Register (terminal) — tambah / edit kod, nama, lokasi, senarai harga (migration 156) / aktif / padam;
// Padam register & kasyer hanya dibenarkan bila tiada sejarah (server 409 bila ada) — yang bersejarah dinyahaktifkan.
// Kasyer + PIN; Akses akaun peranti (pos_staff).
// UI dalam Bahasa Inggeris (keputusan pemilik 9 Nov 2026 — seluruh seksyen admin POS).
interface Register { id: string; code: string; name: string; location: string | null; is_active: boolean; price_list_id?: string | null; outlet_id?: string | null }
interface PriceListLite { id: string; name: string; is_active: boolean }
interface OutletLite { id: string; code: string; name: string; type: string; is_active: boolean }
interface Cashier { id: string; name: string; role: 'cashier' | 'manager'; is_active: boolean; failed_attempts: number; locked_until: string | null }
interface Staff { profile_id: string; is_active: boolean; profiles: { email: string | null; is_admin: boolean } | null }

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'Failed')
  return j
}

const BTN = 'h-8 px-3 rounded-md text-xs font-semibold border border-gray-300 inline-flex items-center gap-1'
const toggleCls = (on: boolean) => `h-8 px-3 rounded-md text-xs font-semibold border ${on ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-500'}`

export function PosCashiersClient() {
  const [registers, setRegisters] = useState<Register[]>([])
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [lists, setLists] = useState<PriceListLite[]>([])
  const [outlets, setOutlets] = useState<OutletLite[]>([])
  const [pinEnabled, setPinEnabled] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [tick, setTick] = useState(0)
  const load = () => setTick(t => t + 1)
  useEffect(() => {
    let alive = true
    // Senarai harga toleran: 156 belum run → [] (page tetap berfungsi)
    Promise.all([api('/api/admin/pos/registers'), api('/api/admin/pos/cashiers'), api('/api/admin/pos/staff'), api('/api/admin/pos/price-lists').catch(() => ({ lists: [] })), api('/api/admin/pos/outlets').catch(() => ({ outlets: [] }))])
      .then(([r, c, s, pl, ou]) => { if (!alive) return; setRegisters(r.registers); setCashiers(c.cashiers); setPinEnabled(c.pinEnabled !== false); setStaff(s.staff); setLists(pl.lists ?? []); setOutlets(ou.outlets ?? []); setErr(null) })
      .catch(e => { if (alive) setErr(e instanceof Error ? e.message : 'Failed to load') })
    return () => { alive = false }
  }, [tick])

  const run = async (fn: () => Promise<unknown>, ok: string): Promise<boolean> => { try { await fn(); toast.success(ok); load(); return true } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); return false } }

  // forms
  const [regCode, setRegCode] = useState(''); const [regName, setRegName] = useState(''); const [regLoc, setRegLoc] = useState('')
  const [cName, setCName] = useState(''); const [cRole, setCRole] = useState<'cashier' | 'manager'>('cashier'); const [cPin, setCPin] = useState('')
  const [email, setEmail] = useState('')

  return (
    <div className="space-y-8">
      <div><h1 className="text-xl font-bold text-gray-900">POS Cashiers &amp; Access</h1><p className="text-sm text-gray-500">Registers, cashiers (PIN) and device accounts allowed to open the POS.</p></div>
      {err && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">{err} — run migration 155 if you have not yet.</div>}
      {!pinEnabled && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">Env <code>POS_PIN_SECRET</code> is not set on the server — cashier PINs will not work.</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">Registers / terminals</h2>
        <p className="text-xs text-gray-500">One per counter or bazaar stall. The code (e.g. T1, B1) is printed on receipts and used for offline references. Price list = which prices this register charges (set up lists in POS Products). Outlet = whose stock its sales deduct (HQ = store stock).</p>
        <ul className="divide-y divide-gray-100">
          {registers.map(r => <RegisterRow key={r.id} r={r} run={run} lists={lists} outlets={outlets} />)}
          {registers.length === 0 && <li className="py-2 text-sm text-gray-400">No registers yet.</li>}
        </ul>
        <form onSubmit={e => { e.preventDefault(); run(() => api('/api/admin/pos/registers', { method: 'POST', body: JSON.stringify({ code: regCode, name: regName, location: regLoc }) }), 'Register added').then(ok => { if (ok) { setRegCode(''); setRegName(''); setRegLoc('') } }) }} className="flex flex-wrap gap-2">
          <input value={regCode} onChange={e => setRegCode(e.target.value.toUpperCase())} placeholder="Code (B1)" className="h-10 w-24 px-3 rounded-lg border border-gray-300 text-sm font-mono" required />
          <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Name (Bazar Bangi)" className="h-10 flex-1 min-w-40 px-3 rounded-lg border border-gray-300 text-sm" required />
          <input value={regLoc} onChange={e => setRegLoc(e.target.value)} placeholder="Location" className="h-10 flex-1 min-w-32 px-3 rounded-lg border border-gray-300 text-sm" />
          <button type="submit" className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">Cashiers &amp; PIN</h2>
        <p className="text-xs text-gray-500">Cashiers are not login accounts — a name + 4–6 digit PIN on the device. Managers can void sales and approve discounts above the limit.</p>
        <ul className="divide-y divide-gray-100">
          {cashiers.map(c => {
            const locked = c.locked_until && new Date(c.locked_until) > new Date()
            return (
              <li key={c.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                {c.role === 'manager' ? <Lock className="h-4 w-4 text-gray-700" /> : <UserRound className="h-4 w-4 text-gray-400" />}
                <span className="font-semibold flex-1">{c.name} <span className="text-xs font-normal text-gray-400">{c.role}{locked ? ' · locked' : ''}</span></span>
                <button type="button" onClick={() => run(() => api('/api/admin/pos/cashiers', { method: 'PATCH', body: JSON.stringify({ id: c.id, role: c.role === 'manager' ? 'cashier' : 'manager' }) }), 'Role changed')} className={BTN}>{c.role === 'manager' ? 'Make cashier' : 'Make manager'}</button>
                <button type="button" onClick={() => { const pin = prompt(`New PIN for ${c.name} (4–6 digits):`); if (pin) run(() => api('/api/admin/pos/cashiers', { method: 'PATCH', body: JSON.stringify({ id: c.id, pin }) }), 'PIN reset') }} className={BTN}><KeyRound className="h-3.5 w-3.5" /> Reset PIN</button>
                {locked && <button type="button" onClick={() => run(() => api('/api/admin/pos/cashiers', { method: 'PATCH', body: JSON.stringify({ id: c.id, unlock: true }) }), 'Unlocked')} className={BTN}><Unlock className="h-3.5 w-3.5" /> Unlock</button>}
                <button type="button" onClick={() => run(() => api('/api/admin/pos/cashiers', { method: 'PATCH', body: JSON.stringify({ id: c.id, is_active: !c.is_active }) }), 'Updated')} className={toggleCls(c.is_active)}>{c.is_active ? 'Active' : 'Inactive'}</button>
                <button type="button" onClick={() => { if (confirm(`Delete cashier ${c.name}? This cannot be undone.`)) run(() => api(`/api/admin/pos/cashiers?id=${c.id}`, { method: 'DELETE' }), 'Cashier deleted') }} className="h-8 w-8 grid place-items-center rounded-md hover:bg-red-50 text-red-700" aria-label="Delete cashier" title="Delete"><Trash2 className="h-4 w-4" /></button>
              </li>
            )
          })}
          {cashiers.length === 0 && <li className="py-2 text-sm text-gray-400">No cashiers yet.</li>}
        </ul>
        <form onSubmit={e => { e.preventDefault(); run(() => api('/api/admin/pos/cashiers', { method: 'POST', body: JSON.stringify({ name: cName, role: cRole, pin: cPin }) }), 'Cashier added').then(ok => { if (ok) { setCName(''); setCPin('') } }) }} className="flex flex-wrap gap-2">
          <input value={cName} onChange={e => setCName(e.target.value)} placeholder="Cashier name" className="h-10 flex-1 min-w-40 px-3 rounded-lg border border-gray-300 text-sm" required />
          <select value={cRole} onChange={e => setCRole(e.target.value as 'cashier' | 'manager')} className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"><option value="cashier">Cashier</option><option value="manager">Manager</option></select>
          <input value={cPin} onChange={e => setCPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="PIN (4–6 digits)" inputMode="numeric" className="h-10 w-36 px-3 rounded-lg border border-gray-300 text-sm font-mono" required />
          <button type="submit" className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">POS access (device accounts)</h2>
        <p className="text-xs text-gray-500">Login accounts allowed to open pos.syababfresh.my. Admins always can. Create the device account (non-admin) in <Link href="/admin/team" className="underline">Admin Users</Link> first, then add its email here.</p>
        <ul className="divide-y divide-gray-100">
          {staff.map(s => (
            <li key={s.profile_id} className="py-2 flex items-center gap-3 text-sm">
              <span className="flex-1">{s.profiles?.email ?? s.profile_id}{s.profiles?.is_admin && <span className="text-xs text-gray-400"> · admin</span>}</span>
              <button type="button" onClick={() => run(() => api('/api/admin/pos/staff', { method: 'PATCH', body: JSON.stringify({ profile_id: s.profile_id, is_active: !s.is_active }) }), 'Updated')} className={toggleCls(s.is_active)}>{s.is_active ? 'Active' : 'Inactive'}</button>
              <button type="button" onClick={() => { if (confirm('Remove POS access for this account?')) run(() => api(`/api/admin/pos/staff?profile_id=${s.profile_id}`, { method: 'DELETE' }), 'Access removed') }} className="h-8 w-8 grid place-items-center rounded-md hover:bg-red-50 text-red-700" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
          {staff.length === 0 && <li className="py-2 text-sm text-gray-400">No device accounts yet.</li>}
        </ul>
        <form onSubmit={e => { e.preventDefault(); run(() => api('/api/admin/pos/staff', { method: 'POST', body: JSON.stringify({ email }) }), 'Access granted').then(ok => { if (ok) setEmail('') }) }} className="flex gap-2">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="device account email" className="h-10 flex-1 px-3 rounded-lg border border-gray-300 text-sm" required />
          <button type="submit" className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Grant access</button>
        </form>
      </section>
    </div>
  )
}

/** Baris register: paparan + mod edit sebaris (kod, nama, lokasi, senarai harga) + togol aktif. */
function RegisterRow({ r, run, lists, outlets }: { r: Register; run: (fn: () => Promise<unknown>, ok: string) => Promise<boolean>; lists: PriceListLite[]; outlets: OutletLite[] }) {
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState(r.code); const [name, setName] = useState(r.name); const [loc, setLoc] = useState(r.location ?? '')
  const [plId, setPlId] = useState(r.price_list_id ?? '')
  const [outId, setOutId] = useState(r.outlet_id ?? '')
  const [saving, setSaving] = useState(false)
  const listName = lists.find(l => l.id === r.price_list_id)?.name ?? null
  const outlet = outlets.find(o => o.id === r.outlet_id) ?? null
  const start = () => { setCode(r.code); setName(r.name); setLoc(r.location ?? ''); setPlId(r.price_list_id ?? ''); setOutId(r.outlet_id ?? ''); setEditing(true) }
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const ok = await run(() => api('/api/admin/pos/registers', { method: 'PATCH', body: JSON.stringify({ id: r.id, code, name, location: loc, ...(lists.length || r.price_list_id ? { price_list_id: plId || null } : {}), ...(outlets.length || r.outlet_id ? { outlet_id: outId || null } : {}) }) }), 'Register updated')
    setSaving(false)
    if (ok) setEditing(false)
  }
  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={save} className="flex flex-wrap items-center gap-2 text-sm">
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Code" className="h-9 w-24 px-3 rounded-lg border border-gray-300 text-sm font-mono" required />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="h-9 flex-1 min-w-40 px-3 rounded-lg border border-gray-300 text-sm" required />
          <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="Location" className="h-9 flex-1 min-w-32 px-3 rounded-lg border border-gray-300 text-sm" />
          {outlets.length > 0 && (
            <select value={outId} onChange={e => setOutId(e.target.value)} aria-label="Outlet" className="h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white">
              <option value="">No outlet</option>
              {outlets.map(o => <option key={o.id} value={o.id}>{o.code} · {o.name}{o.type === 'hq' ? ' (HQ)' : ''}</option>)}
            </select>
          )}
          {lists.length > 0 && (
            <select value={plId} onChange={e => setPlId(e.target.value)} aria-label="Price list" className="h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white">
              <option value="">Store prices (default)</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}{!l.is_active ? ' (inactive)' : ''}</option>)}
            </select>
          )}
          <button type="submit" disabled={saving} className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Save</button>
          <button type="button" onClick={() => setEditing(false)} className="h-9 px-3 rounded-lg border border-gray-300 text-xs font-semibold inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> Cancel</button>
        </form>
      </li>
    )
  }
  return (
    <li className="py-2 flex items-center gap-3 text-sm">
      <span className="font-mono font-bold w-14">{r.code}</span>
      <span className="flex-1">{r.name}<span className="text-gray-400">{r.location ? ` · ${r.location}` : ''}</span><span className="block text-xs text-gray-400">Prices: {listName ?? 'Store (default)'}{outlets.length > 0 ? <> · Outlet: {outlet ? `${outlet.code} ${outlet.name}` : 'none'}</> : null}</span></span>
      <button type="button" onClick={start} className={BTN}><Pencil className="h-3.5 w-3.5" /> Edit</button>
      <button type="button" onClick={() => run(() => api('/api/admin/pos/registers', { method: 'PATCH', body: JSON.stringify({ id: r.id, is_active: !r.is_active }) }), 'Updated')} className={toggleCls(r.is_active)}>{r.is_active ? 'Active' : 'Inactive'}</button>
      {/* Padam: hanya register tanpa jualan/shift; yang ada sejarah ditolak server (409) → guna Inactive */}
      <button type="button" onClick={() => { if (confirm(`Delete register ${r.code} · ${r.name}? This cannot be undone.`)) run(() => api(`/api/admin/pos/registers?id=${r.id}`, { method: 'DELETE' }), 'Register deleted') }} className="h-8 w-8 grid place-items-center rounded-md hover:bg-red-50 text-red-700" aria-label="Delete register" title="Delete"><Trash2 className="h-4 w-4" /></button>
    </li>
  )
}
