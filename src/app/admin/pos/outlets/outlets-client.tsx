'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Download, Store, Truck, Loader2, Pencil } from 'lucide-react'
import { fmtQty, rm } from '@/lib/pos/money'
import { fmtKl } from '@/lib/pos/receipt'
import type { PosOutlet, OutletStockRow } from '@/lib/pos/outlets'

// Outlets (migration 157): kad per outlet (DO menunggu, baris stok, jualan hari ini) + stok outlet terpilih
// (pelarasan / kiraan / rosak) + lejar pergerakan. HQ = stok kedai (tiada jadual di sini). UI Bahasa Inggeris.

interface Outlet extends PosOutlet { stats: { pending: number; stockLines: number; sales: number; revenue: number } }
interface Movement { id: string; name: string; variant_name: string | null; unit: 'pcs' | 'kg'; qty: number; type: string; note: string | null; created_at: string; cashier: string | null; ref_type: string | null }

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'Failed')
  return j
}
const TYPE_LABEL: Record<string, string> = { hq: 'HQ', bazaar: 'Bazaar', store: 'Store' }
const MOVE_LABEL: Record<string, string> = { transfer_in: 'DO in', transfer_out: 'DO out', sale: 'Sale', void_restore: 'Void restore', adjustment: 'Adjustment', wastage: 'Wastage', count: 'Stock count' }

export function PosOutletsClient() {
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [ok, setOk] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<string>('')
  const [rows, setRows] = useState<OutletStockRow[]>([])
  const [moves, setMoves] = useState<Movement[]>([])
  const [stockLoadedFor, setStockLoadedFor] = useState('')      // `${sel}|${tick}` yang dah dimuat → loading = beza
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    let alive = true
    api('/api/admin/pos/outlets').then(j => { if (!alive) return; setOutlets(j.outlets); setOk(j.migrationOk !== false); setErr(null) })
      .catch(e => { if (alive) { setOk(false); setErr(e instanceof Error ? e.message : 'Failed to load') } })
    return () => { alive = false }
  }, [tick])

  const stockKey = `${sel}|${tick}`
  const loadingStock = !!sel && stockLoadedFor !== stockKey
  useEffect(() => {
    if (!sel) return
    let alive = true
    Promise.all([api(`/api/admin/pos/outlet-stock?outlet=${sel}`), api(`/api/admin/pos/stock-movements?outlet=${sel}&limit=150`)])
      .then(([s, m]) => { if (!alive) return; setRows(s.rows); setMoves(m.rows); setStockLoadedFor(stockKey) })
      .catch(e => { if (alive) { toast.error(e instanceof Error ? e.message : 'Failed'); setStockLoadedFor(stockKey) } })
    return () => { alive = false }
  }, [sel, tick, stockKey])

  const selected = outlets.find(o => o.id === sel) ?? null

  // Borang outlet baharu
  const [code, setCode] = useState(''); const [name, setName] = useState(''); const [type, setType] = useState<'bazaar' | 'store'>('bazaar'); const [loc, setLoc] = useState('')
  const addOutlet = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await api('/api/admin/pos/outlets', { method: 'POST', body: JSON.stringify({ code, name, type, location: loc }) }); toast.success('Outlet added'); setCode(''); setName(''); setLoc(''); reload() }
    catch (er) { toast.error(er instanceof Error ? er.message : 'Failed') }
  }
  const toggle = async (o: Outlet) => {
    try { await api('/api/admin/pos/outlets', { method: 'PATCH', body: JSON.stringify({ id: o.id, is_active: !o.is_active }) }); reload() } catch (er) { toast.error(er instanceof Error ? er.message : 'Failed') }
  }
  const rename = async (o: Outlet) => {
    const nm = prompt('Outlet name:', o.name)?.trim(); if (!nm || nm === o.name) return
    const lc = prompt('Location (optional):', o.location ?? '') ?? o.location ?? ''
    try { await api('/api/admin/pos/outlets', { method: 'PATCH', body: JSON.stringify({ id: o.id, name: nm, location: lc }) }); reload() } catch (er) { toast.error(er instanceof Error ? er.message : 'Failed') }
  }

  const adjust = async (r: OutletStockRow, kind: 'count' | 'wastage') => {
    if (!selected) return
    const label = `${r.name}${r.variant_name ? ` ${r.variant_name}` : ''}`
    const v = prompt(kind === 'count' ? `Counted quantity for ${label} (${r.unit}) — current ${fmtQty(r.qty, r.unit)}:` : `Wastage quantity for ${label} (${r.unit}) to remove:`)
    if (v == null || v.trim() === '') return
    const num = Number(v); if (!Number.isFinite(num) || num < 0) { toast.error('Invalid quantity'); return }
    const note = prompt('Note (optional):') ?? ''
    try {
      await api('/api/admin/pos/outlet-stock', { method: 'PATCH', body: JSON.stringify(kind === 'count' ? { outlet_id: selected.id, product_id: r.product_id, variant_id: r.variant_id, unit: r.unit, set_qty: num, type: 'count', note } : { outlet_id: selected.id, product_id: r.product_id, variant_id: r.variant_id, unit: r.unit, delta: -num, type: 'wastage', note }) })
      toast.success(kind === 'count' ? 'Stock count saved' : 'Wastage recorded'); reload()
    } catch (er) { toast.error(er instanceof Error ? er.message : 'Failed') }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">POS Outlets</h1><p className="text-sm text-gray-500">Stock per outlet, today&apos;s sales and pending deliveries. HQ uses the store stock; outlets receive stock through delivery orders.</p></div>
        <Link href="/admin/pos/transfers" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold"><Truck className="h-4 w-4" /> Delivery orders</Link>
      </div>
      {!ok && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">{err ?? 'Migration 157 (outlets) has not been run'} — outlets, outlet stock and delivery orders are unavailable until then.</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {outlets.map(o => (
          <button key={o.id} type="button" onClick={() => setSel(o.id === sel ? '' : o.id)} className={`text-left rounded-xl border p-4 ${sel === o.id ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-200 bg-white hover:border-gray-300'} ${!o.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-mono text-xs font-bold text-gray-500">{o.code} · {TYPE_LABEL[o.type] ?? o.type}</p><p className="font-semibold text-gray-900">{o.name}</p><p className="text-xs text-gray-400">{o.location ?? '—'}</p></div>
              <Store className="h-5 w-5 text-gray-400" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-bold tabular-nums">{o.stats.pending}</p><p className="text-[10px] text-gray-500">DO pending</p></div>
              <div><p className="text-lg font-bold tabular-nums">{o.type === 'hq' ? '—' : o.stats.stockLines}</p><p className="text-[10px] text-gray-500">stock lines</p></div>
              <div><p className="text-lg font-bold tabular-nums">{o.stats.sales}</p><p className="text-[10px] text-gray-500">sales today</p></div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Revenue today <span className="font-semibold text-gray-900">{rm(o.stats.revenue)}</span></p>
          </button>
        ))}
      </div>

      {selected && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">{selected.code} · {selected.name}</h2>
              <button type="button" onClick={() => rename(selected)} className="h-8 px-2 rounded-md border border-gray-300 text-xs font-semibold inline-flex items-center gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</button>
              <button type="button" onClick={() => toggle(selected)} className={`h-8 px-3 rounded-md text-xs font-semibold border ${selected.is_active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-500'}`}>{selected.is_active ? 'Active' : 'Inactive'}</button>
            </div>
            {selected.type !== 'hq' && <a href={`/api/admin/pos/outlet-stock?outlet=${selected.id}&format=csv`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-300 text-sm font-semibold bg-white"><Download className="h-4 w-4" /> Stock CSV</a>}
          </div>
          {selected.type === 'hq' ? (
            <p className="text-sm text-gray-500">HQ stock is the store stock — see <Link href="/admin/inventory" className="underline">Inventory</Link>. Delivery orders issued from HQ deduct packed items there; weighed fruit (kg) at HQ is tracked in the ops app.</p>
          ) : loadingStock ? <div className="py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : (
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Stock on hand</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Updated</th><th className="px-3 py-2"></th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map(r => (
                        <tr key={r.id} className={r.qty <= 0 ? 'text-gray-400' : ''}>
                          <td className="px-3 py-2">{r.name}{r.variant_name && <span className="text-gray-500"> · {r.variant_name}</span>}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtQty(r.qty, r.unit)}</td>
                          <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtKl(r.updated_at)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <button type="button" onClick={() => adjust(r, 'count')} className="h-7 px-2 rounded-md border border-gray-200 text-xs font-semibold">Count</button>
                            <button type="button" onClick={() => adjust(r, 'wastage')} className="ml-1 h-7 px-2 rounded-md border border-gray-200 text-xs font-semibold text-red-700">Wastage</button>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No stock yet — issue a delivery order from HQ.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Movements (latest 150)</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-[520px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 sticky top-0"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Note</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {moves.map(m => (
                        <tr key={m.id}>
                          <td className="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap">{fmtKl(m.created_at)}</td>
                          <td className="px-3 py-1.5 text-xs font-semibold">{MOVE_LABEL[m.type] ?? m.type}</td>
                          <td className="px-3 py-1.5">{m.name}{m.variant_name && <span className="text-gray-500"> · {m.variant_name}</span>}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${m.qty < 0 ? 'text-red-700' : 'text-gray-900'}`}>{m.qty > 0 ? '+' : ''}{fmtQty(m.qty, m.unit)}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">{m.note ?? ''}{m.cashier ? ` · ${m.cashier}` : ''}</td>
                        </tr>
                      ))}
                      {moves.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No movements yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 max-w-4xl">
        <h2 className="font-semibold text-gray-900">New outlet</h2>
        <form onSubmit={addOutlet} className="flex flex-wrap gap-2">
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Code (BZ1)" className="h-10 w-28 px-3 rounded-lg border border-gray-300 text-sm font-mono" required disabled={!ok} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (Bazar Ramadan Bangi)" className="h-10 flex-1 min-w-48 px-3 rounded-lg border border-gray-300 text-sm" required disabled={!ok} />
          <select value={type} onChange={e => setType(e.target.value as 'bazaar' | 'store')} className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white" disabled={!ok}><option value="bazaar">Bazaar</option><option value="store">Store</option></select>
          <input value={loc} onChange={e => setLoc(e.target.value)} placeholder="Location" className="h-10 flex-1 min-w-40 px-3 rounded-lg border border-gray-300 text-sm" disabled={!ok} />
          <button type="submit" disabled={!ok} className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Plus className="h-4 w-4" /> Add</button>
        </form>
        <p className="text-xs text-gray-500">Then point the outlet&apos;s registers at it in <Link href="/admin/pos/cashiers" className="underline">Cashiers &amp; Access</Link> (register Edit → Outlet). Sales on those registers deduct this outlet&apos;s stock.</p>
      </section>
    </div>
  )
}
