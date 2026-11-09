'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Printer, Send, Check, X, Trash2, Search, ChevronDown, ChevronUp, Loader2, Store } from 'lucide-react'
import { fmtKl } from '@/lib/pos/receipt'
import type { PosCatalog, PosCatalogItem } from '@/lib/pos/types'
import type { PosOutlet, TransferRow, TransferUnit } from '@/lib/pos/outlets'

// Pindahan HQ → outlet (DO) — migration 157. Senarai (tapis status/outlet) + borang DO baharu (pilih item dari
// katalog POS; unit pcs / kg / ctn × pack size; baris bebas) + tindakan Issue · Confirm (bagi pihak) · Cancel · Print.
// Cetak: /pos/do/<id>?print=1 (A4) atau &size=80 (terma). UI Bahasa Inggeris.

interface Line { key: string; product_id: string | null; variant_id: string | null; name: string; variant_name: string | null; unit: TransferUnit; qty: string; pack_size: string }
async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'Failed')
  return j
}
const STATUS_CLS: Record<string, string> = { draft: 'border-gray-300 text-gray-600', issued: 'bg-gray-900 text-white border-gray-900', confirmed: 'bg-gray-100 text-gray-900 border-gray-300', cancelled: 'border-gray-200 text-gray-400 line-through' }
const qtyStr = (q: number, unit: string) => unit === 'kg' ? `${Number(q).toFixed(3).replace(/\.?0+$/, '')} kg` : unit === 'ctn' ? `${Number(q)} ctn` : `${Number(q)} pcs`
let seq = 0
const newKey = () => `l${Date.now()}-${seq++}`

export function PosTransfersClient() {
  const [outlets, setOutlets] = useState<PosOutlet[]>([])
  const [rows, setRows] = useState<TransferRow[]>([])
  const [ok, setOk] = useState(true)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)   // kunci tapisan yang dah dimuat → loading = beza
  const [status, setStatus] = useState('')
  const [outletF, setOutletF] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    let alive = true
    api('/api/admin/pos/outlets').then(j => { if (alive) { setOutlets(j.outlets ?? []); setOk(j.migrationOk !== false) } }).catch(() => { if (alive) setOk(false) })
    return () => { alive = false }
  }, [])
  const listKey = `${status}|${outletF}|${tick}`
  const loading = loadedKey !== listKey
  useEffect(() => {
    let alive = true
    api(`/api/admin/pos/transfers?${status ? `status=${status}&` : ''}${outletF ? `outlet=${outletF}` : ''}`).then(j => { if (alive) { setRows(j.transfers ?? []); setLoadedKey(listKey) } })
      .catch(e => { if (alive) { setLoadedKey(listKey); if (ok) toast.error(e instanceof Error ? e.message : 'Failed') } })
    return () => { alive = false }
  }, [status, outletF, tick, ok, listKey])

  const act = async (t: TransferRow, action: 'issue' | 'confirm' | 'cancel') => {
    if (action === 'cancel' && !confirm('Cancel this draft?')) return
    if (action === 'confirm' && !confirm(`Confirm ${t.doc_no} as received in full on behalf of ${t.to_outlet?.name}? Staff can also confirm on the outlet tablet (POS → Receive).`)) return
    try {
      const j = await api(`/api/admin/pos/transfers/${t.id}`, { method: 'POST', body: JSON.stringify({ action }) })
      toast.success(action === 'issue' ? `${j.transfer.doc_no} issued — stock moved` : action === 'confirm' ? 'Confirmed' : 'Cancelled')
      if (action === 'issue') window.open(`/pos/do/${t.id}?print=1`, '_blank', 'noopener')
      reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">Delivery orders</h1><p className="text-sm text-gray-500">Goods leaving HQ for an outlet (or returning). Issuing a DO moves stock immediately; the outlet confirms what it received.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={outletF} onChange={e => setOutletF(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"><option value="">All outlets</option>{outlets.map(o => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}</select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"><option value="">All statuses</option><option value="draft">Draft</option><option value="issued">Issued (awaiting outlet)</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select>
          <Link href="/admin/pos/outlets" className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-gray-300 text-sm font-semibold bg-white"><Store className="h-4 w-4" /> Outlets</Link>
          <button type="button" onClick={() => setCreating(v => !v)} disabled={!ok} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"><Plus className="h-4 w-4" /> New DO</button>
        </div>
      </div>
      {!ok && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">Migration 157 (outlets) has not been run — delivery orders are unavailable until then.</div>}

      {creating && <NewTransferForm outlets={outlets} onDone={(t) => { setCreating(false); reload(); if (t?.status === 'issued') window.open(`/pos/do/${t.id}?print=1`, '_blank', 'noopener') }} onCancel={() => setCreating(false)} />}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">DO no.</th><th className="px-3 py-2">From → To</th><th className="px-3 py-2">Lines</th><th className="px-3 py-2">Issued</th><th className="px-3 py-2">Confirmed</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No delivery orders yet.</td></tr>}
            {rows.map(t => {
              const items = t.pos_transfer_items ?? []
              const variance = items.some(i => i.received_qty != null && Number(i.received_qty) !== Number(i.base_qty))
              const short = items.some(i => Number(i.hq_stock_short) > 0)
              return (
                <RowGroup key={t.id} t={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} variance={variance} short={short} onAct={a => act(t, a)} />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RowGroup({ t, open, onToggle, variance, short, onAct }: { t: TransferRow; open: boolean; onToggle: () => void; variance: boolean; short: boolean; onAct: (a: 'issue' | 'confirm' | 'cancel') => void }) {
  const items = t.pos_transfer_items ?? []
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{t.doc_no ?? <span className="text-gray-400">DRAFT</span>}{t.kind === 'return' && <span className="ml-1 text-[10px] font-bold text-gray-500 uppercase">return</span>}{short && <span className="ml-1 text-[10px] font-bold text-amber-700 uppercase" title="HQ stock was short when issued">hq short</span>}{variance && <span className="ml-1 text-[10px] font-bold text-amber-700 uppercase" title="Received quantity differs from sent">variance</span>}</td>
        <td className="px-3 py-2 text-gray-700">{t.from_outlet?.code ?? '—'} → <span className="font-semibold">{t.to_outlet?.code ?? '—'}</span> <span className="text-gray-400">{t.to_outlet?.name}</span></td>
        <td className="px-3 py-2 tabular-nums text-gray-600">{items.length}</td>
        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{t.issued_at ? fmtKl(t.issued_at) : '—'}</td>
        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{t.confirmed_at ? <>{fmtKl(t.confirmed_at)}{t.confirmed_cashier?.name ? <span className="block">{t.confirmed_cashier.name}</span> : null}</> : '—'}</td>
        <td className="px-3 py-2"><span className={`inline-flex h-6 px-2 items-center rounded-md border text-[11px] font-bold uppercase ${STATUS_CLS[t.status]}`}>{t.status}</span></td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          {t.status === 'draft' && <button type="button" onClick={() => onAct('issue')} className="inline-flex h-8 px-2.5 items-center gap-1 rounded-md bg-gray-900 text-white text-xs font-semibold" title="Issue — assign DO number and move stock"><Send className="h-3.5 w-3.5" /> Issue</button>}
          {t.status === 'draft' && <button type="button" onClick={() => onAct('cancel')} className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-red-700" title="Cancel draft"><Trash2 className="h-4 w-4" /></button>}
          {t.status === 'issued' && <button type="button" onClick={() => onAct('confirm')} className="inline-flex h-8 px-2.5 items-center gap-1 rounded-md border border-gray-300 text-xs font-semibold" title="Confirm received in full (on behalf of outlet)"><Check className="h-3.5 w-3.5" /> Confirm</button>}
          {t.status !== 'draft' && t.status !== 'cancelled' && <>
            <a href={`/pos/do/${t.id}?print=1`} target="_blank" rel="noreferrer" className="ml-1 inline-flex h-8 px-2.5 items-center gap-1 rounded-md border border-gray-300 text-xs font-semibold" title="Print A4"><Printer className="h-3.5 w-3.5" /> A4</a>
            <a href={`/pos/do/${t.id}?print=1&size=80`} target="_blank" rel="noreferrer" className="ml-1 inline-flex h-8 px-2.5 items-center rounded-md border border-gray-300 text-xs font-semibold" title="Print 80mm">80mm</a>
          </>}
          <button type="button" onClick={onToggle} className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        </td>
      </tr>
      {open && (
        <tr className="bg-gray-50/70">
          <td colSpan={7} className="px-4 py-3">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold text-gray-500"><tr><th className="py-1 pr-3">#</th><th className="py-1 pr-3">Item</th><th className="py-1 pr-3 text-right">Sent</th><th className="py-1 pr-3 text-right">= Stock qty</th><th className="py-1 pr-3 text-right">Received</th><th className="py-1 pr-3">Note</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((i, idx) => {
                  const diff = i.received_qty != null ? Number(i.received_qty) - Number(i.base_qty) : 0
                  return (
                    <tr key={i.id}>
                      <td className="py-1 pr-3 text-gray-400">{idx + 1}</td>
                      <td className="py-1 pr-3">{i.name}{i.variant_name && <span className="text-gray-500"> · {i.variant_name}</span>}{Number(i.hq_stock_short) > 0 && <span className="ml-1 text-[10px] font-bold text-amber-700 uppercase">hq short {Number(i.hq_stock_short)}</span>}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{qtyStr(Number(i.qty), i.unit)}{i.unit === 'ctn' && i.pack_size ? <span className="text-gray-400"> × {Number(i.pack_size)}</span> : null}</td>
                      <td className="py-1 pr-3 text-right tabular-nums font-semibold">{qtyStr(Number(i.base_qty), i.base_unit)}</td>
                      <td className={`py-1 pr-3 text-right tabular-nums ${diff !== 0 ? 'font-bold text-amber-700' : ''}`}>{i.received_qty == null ? '—' : <>{qtyStr(Number(i.received_qty), i.base_unit)}{diff !== 0 && <span className="text-xs"> ({diff > 0 ? '+' : ''}{diff})</span>}</>}</td>
                      <td className="py-1 pr-3 text-xs text-gray-500">{i.note ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(t.note || t.confirmed_note) && <p className="mt-2 text-xs text-gray-600">{t.note && <>Note: {t.note}</>}{t.confirmed_note && <span className="block">Outlet: {t.confirmed_note}</span>}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

function NewTransferForm({ outlets, onDone, onCancel }: { outlets: PosOutlet[]; onDone: (t: TransferRow | null) => void; onCancel: () => void }) {
  const hq = outlets.find(o => o.type === 'hq') ?? null
  const others = outlets.filter(o => o.type !== 'hq' && o.is_active)
  const [from, setFrom] = useState(hq?.id ?? '')
  const [to, setTo] = useState(others[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [q, setQ] = useState('')
  const [catalog, setCatalog] = useState<PosCatalog | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { fetch('/api/pos/catalog', { cache: 'no-store' }).then(r => r.json()).then(j => j?.items && setCatalog(j)).catch(() => toast.error('Failed to load catalog')) }, [])
  // Bila senarai outlet tiba selepas render pertama, isi lalai (corak adjust-state-during-render)
  const [seeded, setSeeded] = useState(false)
  if (!seeded && outlets.length > 0) { setSeeded(true); if (!from && hq) setFrom(hq.id); if (!to && others[0]) setTo(others[0].id) }

  const results = useMemo(() => {
    if (!catalog) return [] as PosCatalogItem[]
    const s = q.trim().toLowerCase()
    if (!s) return []
    return catalog.items.filter(i => `${i.name} ${i.variantName ?? ''} ${i.sku ?? ''}`.toLowerCase().includes(s)).slice(0, 12)
  }, [catalog, q])

  const addItem = (it: PosCatalogItem) => {
    setLines(ls => [...ls, { key: newKey(), product_id: it.productId, variant_id: it.variantId, name: it.name, variant_name: it.unit === 'kg' ? null : it.variantName, unit: it.unit === 'kg' ? 'kg' : 'pcs', qty: '', pack_size: '' }])
    setQ('')
  }
  const addCustom = () => { const name = prompt('Line description (no stock tracking):')?.trim(); if (name) setLines(ls => [...ls, { key: newKey(), product_id: null, variant_id: null, name, variant_name: null, unit: 'pcs', qty: '', pack_size: '' }]) }
  const upd = (key: string, patch: Partial<Line>) => setLines(ls => ls.map(l => l.key === key ? { ...l, ...patch } : l))
  const baseQty = (l: Line) => { const qn = Number(l.qty); if (!Number.isFinite(qn) || qn <= 0) return null; if (l.unit === 'ctn') { const p = Number(l.pack_size); return Number.isFinite(p) && p > 0 ? qn * p : null } return qn }

  const submit = async (issue: boolean) => {
    if (!from || !to) { toast.error('Choose From and To outlets'); return }
    if (lines.length === 0) { toast.error('Add at least one line'); return }
    for (const l of lines) if (baseQty(l) == null) { toast.error(`Check quantity${l.unit === 'ctn' ? ' and pack size' : ''} for ${l.name}`); return }
    setBusy(true)
    try {
      const j = await api('/api/admin/pos/transfers', { method: 'POST', body: JSON.stringify({ from_outlet_id: from, to_outlet_id: to, note, issue, items: lines.map(l => ({ product_id: l.product_id, variant_id: l.variant_id, name: l.name, variant_name: l.variant_name, unit: l.unit, qty: Number(l.qty), pack_size: l.unit === 'ctn' ? Number(l.pack_size) : null })) }) })
      toast.success(issue ? `${j.transfer.doc_no} issued — stock moved to outlet` : 'Draft saved')
      onDone(j.transfer)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } finally { setBusy(false) }
  }

  const fromO = outlets.find(o => o.id === from), toO = outlets.find(o => o.id === to)
  return (
    <section className="rounded-xl border border-gray-900 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">New delivery order</h2><button type="button" onClick={onCancel} aria-label="Close" className="h-8 w-8 grid place-items-center rounded-md hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">From</span><select value={from} onChange={e => setFrom(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white">{outlets.map(o => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}</select></label>
        <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">To</span><select value={to} onChange={e => setTo(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"><option value="">— choose outlet —</option>{outlets.filter(o => o.id !== from).map(o => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}</select></label>
        <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Day 1 stock, van Ali" className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm" /></label>
      </div>
      {fromO && toO && <p className="text-xs text-gray-500">{toO.type === 'hq' ? 'Return to HQ: outlet stock goes down, packed items go back into store stock.' : fromO.type === 'hq' ? 'From HQ: packed items are deducted from store stock on issue; weighed fruit (kg) is recorded on the DO only (HQ kg ledger is in the ops app).' : 'Outlet to outlet: stock moves between the two outlets.'}</p>}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={catalog ? 'Search product / variant / SKU to add a line…' : 'Loading catalog…'} className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm" disabled={!catalog} />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg text-sm">
            {results.map(it => <li key={it.key}><button type="button" onClick={() => addItem(it)} className="w-full text-left px-3 py-2 hover:bg-gray-50"><span className="font-semibold">{it.name}</span>{it.variantName && <span className="text-gray-500"> · {it.unit === 'kg' ? 'by weight' : it.variantName}</span>}<span className="float-right text-xs text-gray-400">{it.unit === 'kg' ? 'kg' : `pcs${it.stock != null ? ` · HQ stock ${it.stock}` : ''}`}</span></button></li>)}
          </ul>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Pack size</th><th className="px-3 py-2 text-right">= Stock qty</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((l, idx) => {
              const b = baseQty(l)
              return (
                <tr key={l.key}>
                  <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-2">{l.name}{l.variant_name && <span className="text-gray-500"> · {l.variant_name}</span>}{!l.product_id && <span className="ml-1 text-[10px] font-bold text-gray-400 uppercase">no stock</span>}</td>
                  <td className="px-3 py-2">
                    <select value={l.unit} onChange={e => upd(l.key, { unit: e.target.value as TransferUnit })} className="h-9 px-2 rounded-md border border-gray-300 text-sm bg-white" disabled={l.unit === 'kg' && !!l.product_id}>
                      {l.unit === 'kg' ? <option value="kg">kg</option> : <><option value="pcs">pcs</option><option value="ctn">carton</option></>}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input value={l.qty} onChange={e => upd(l.key, { qty: e.target.value })} inputMode="decimal" placeholder="0" className="h-9 w-24 px-2 rounded-md border border-gray-300 text-sm tabular-nums" /></td>
                  <td className="px-3 py-2">{l.unit === 'ctn' ? <div className="flex items-center gap-1 text-xs"><input value={l.pack_size} onChange={e => upd(l.key, { pack_size: e.target.value })} inputMode="numeric" placeholder="pcs/ctn" className="h-9 w-24 px-2 rounded-md border border-gray-300 text-sm tabular-nums" /></div> : <span className="text-xs text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{b == null ? <span className="text-gray-300">—</span> : qtyStr(b, l.unit === 'kg' ? 'kg' : 'pcs')}</td>
                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} aria-label="Remove" className="h-8 w-8 inline-grid place-items-center rounded-md hover:bg-red-50 text-red-700"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              )
            })}
            {lines.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Search above to add items, or add a free-text line.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={addCustom} className="h-9 px-3 rounded-lg border border-gray-300 text-xs font-semibold inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Free-text line</button>
        <div className="flex gap-2">
          <button type="button" onClick={() => submit(false)} disabled={busy} className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold disabled:opacity-50">Save draft</button>
          <button type="button" onClick={() => submit(true)} disabled={busy} className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Send className="h-4 w-4" /> Issue DO &amp; print</button>
        </div>
      </div>
    </section>
  )
}
