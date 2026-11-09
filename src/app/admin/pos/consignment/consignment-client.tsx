'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Printer, Trash2, Check, RefreshCw, Search, Handshake, Undo2 } from 'lucide-react'
import { klDateStr } from '@/lib/pos/dates'
import { fmtQty } from '@/lib/pos/money'
import { fmtKl } from '@/lib/pos/receipt'
import type { ConsignReport, ConsignSettlement, ConsignStockBalance, Consignor } from '@/lib/pos/consign'

// Konsainan (migration 158): barang pembekal lain dijual di kedai kita.
// Kiri/atas: pembekal (terma: komisen % atau kos seunit) dengan jumlah belum dibayar. Pembekal terpilih → 4 tab:
//  Sales & statements (jualan belum diselesaikan → Create statement → cetak → Mark paid) · Products (paut produk + terma)
//  · Stock (masuk / pulang + baki) · Details (edit, aktif, padam). Kasyer menjual seperti biasa — tiada perubahan di POS.
// UI Bahasa Inggeris (seluruh seksyen admin POS).

interface ConsignorRow extends Consignor { product_count: number; unsettled: { lines: number; sales: number; payable: number } }
interface CProduct { product_id: string; name: string; category: string | null; price: number; unit: string | null; commission_pct: number | null; cost: number | null; variants: { id: string; name: string; price: number; cost: number | null }[] }
interface AllProduct { id: string; name: string; category: string | null; variants: { id: string; name: string }[] }
interface Move { id: string; unit: 'pcs' | 'kg'; qty: number; type: 'in' | 'return'; note: string | null; created_at: string; name: string; variant: string | null }
type Report = Omit<ConsignReport, 'itemIds'>
interface Detail { report: Report | null; settlements: ConsignSettlement[]; products: CProduct[]; balance: ConsignStockBalance[]; moves: Move[] }
type Tab = 'sales' | 'products' | 'stock' | 'details'

const money = (v: number) => `RM${Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'Failed')
  return j
}
const INPUT = 'h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white'
const BTN = 'h-9 px-3 rounded-lg border border-gray-300 text-xs font-semibold inline-flex items-center gap-1 bg-white'
const termsText = (c: Consignor) => c.payout_type === 'commission' ? `Commission ${Number(c.commission_pct)}% to the store` : 'Pay cost per unit'

export function PosConsignmentClient() {
  const [today] = useState(() => klDateStr(new Date()))
  const [consignors, setConsignors] = useState<ConsignorRow[]>([])
  const [ok, setOk] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [selId, setSelId] = useState('')
  const [tab, setTab] = useState<Tab>('sales')
  const [tick, setTick] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [allProducts, setAllProducts] = useState<AllProduct[]>([])
  const [adding, setAdding] = useState(false)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    let alive = true
    api('/api/admin/pos/consignors').then(j => { if (!alive) return; setConsignors(j.consignors ?? []); setOk(j.migrationOk !== false); setErr(null) })
      .catch(e => { if (alive) { setOk(false); setErr(e instanceof Error ? e.message : 'Failed to load') } })
    return () => { alive = false }
  }, [tick])
  useEffect(() => {
    let alive = true
    fetch('/api/admin/pos/product-settings').then(r => r.json()).then(j => { if (alive) setAllProducts(((j.products ?? []) as { id: string; name: string; category: string | null; variants: { id: string; name: string }[] }[]).map(p => ({ id: p.id, name: p.name, category: p.category, variants: p.variants.map(v => ({ id: v.id, name: v.name })) }))) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const key = `${selId}|${from}|${to}|${tick}`
  const loadingDetail = !!selId && detailKey !== key
  useEffect(() => {
    if (!selId) return
    let alive = true
    const range = `${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`
    Promise.all([
      api(`/api/admin/pos/consign-report?consignor=${selId}${range}`), api(`/api/admin/pos/consign-settlements?consignor=${selId}`),
      api(`/api/admin/pos/consign-products?consignor=${selId}`), api(`/api/admin/pos/consign-stock?consignor=${selId}`),
    ]).then(([r, s, p, st]) => { if (!alive) return; setDetail({ report: r.report, settlements: s.settlements ?? [], products: p.products ?? [], balance: st.balance ?? [], moves: st.moves ?? [] }); setDetailKey(key) })
      .catch(e => { if (alive) { toast.error(e instanceof Error ? e.message : 'Failed to load'); setDetailKey(key) } })
    return () => { alive = false }
  }, [selId, from, to, key])

  const selected = consignors.find(c => c.id === selId) ?? null
  const totalOwed = consignors.reduce((a, c) => a + c.unsettled.payable, 0)
  const run = async (fn: () => Promise<unknown>, okMsg: string): Promise<boolean> => { try { await fn(); toast.success(okMsg); reload(); return true } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed'); return false } }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">Consignment</h1><p className="text-sm text-gray-500">Other suppliers&apos; goods sold at your store. Cashiers sell as usual; this page works out what each supplier is owed.{consignors.length > 0 ? ` Unsettled across all suppliers: ${money(totalOwed)}.` : ''}</p></div>
        <button type="button" onClick={() => setAdding(v => !v)} disabled={!ok} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"><Plus className="h-4 w-4" /> New supplier</button>
      </div>
      {!ok && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">{err ?? 'Migration 158 (consignment) has not been run'} — consignment is unavailable until then. Selling is not affected.</div>}

      {adding && <section className="rounded-xl border border-gray-900 bg-white p-4 max-w-4xl"><h2 className="font-semibold text-gray-900 mb-3">New supplier</h2>
        <SupplierForm submitLabel="Add supplier" onCancel={() => setAdding(false)} onSubmit={async v => { try { const j = await api('/api/admin/pos/consignors', { method: 'POST', body: JSON.stringify(v) }); toast.success('Supplier added — now add their products'); setAdding(false); setSelId(j.consignor.id); setTab('products'); reload() } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') } }} /></section>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {consignors.map(c => (
          <button key={c.id} type="button" onClick={() => { setSelId(c.id === selId ? '' : c.id); setFrom(''); setTo('') }} className={`text-left rounded-xl border p-4 ${selId === c.id ? 'border-gray-900 ring-2 ring-gray-900 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'} ${c.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-gray-900 truncate">{c.name}</p><p className="text-xs text-gray-500">{termsText(c)}{c.is_active ? '' : ' · inactive'}</p></div><Handshake className="h-5 w-5 text-gray-400 shrink-0" /></div>
            <p className="mt-3 text-xs text-gray-500">Owed (unsettled)</p>
            <p className="text-xl font-bold text-gray-900">{money(c.unsettled.payable)}</p>
            <p className="text-xs text-gray-400">{c.unsettled.lines} sale {c.unsettled.lines === 1 ? 'line' : 'lines'} · {c.product_count} {c.product_count === 1 ? 'product' : 'products'}</p>
          </button>
        ))}
        {ok && consignors.length === 0 && <p className="text-sm text-gray-500 sm:col-span-2 lg:col-span-4">No suppliers yet. Add one, then link their products.</p>}
      </div>

      {selected && (
        <section className={`rounded-xl border border-gray-200 bg-white p-4 space-y-4 transition-opacity ${loadingDetail && detail ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-gray-900">{selected.name}</h2><p className="text-xs text-gray-500">{termsText(selected)}{selected.phone ? ` · ${selected.phone}` : ''}</p></div>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm font-semibold">
              {([['sales', 'Sales & statements'], ['products', 'Products'], ['stock', 'Stock'], ['details', 'Details']] as [Tab, string][]).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`h-9 px-3 ${tab === id ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}>{label}</button>)}
            </div>
          </div>
          {!detail ? <p className="py-8 text-center text-sm text-gray-400">Loading…</p> : (
            <>
              {tab === 'sales' && <SalesTab c={selected} d={detail} today={today} from={from} to={to} setFrom={setFrom} setTo={setTo} run={run} />}
              {tab === 'products' && <ProductsTab c={selected} d={detail} all={allProducts} run={run} />}
              {tab === 'stock' && <StockTab c={selected} d={detail} run={run} />}
              {tab === 'details' && (
                <div className="space-y-4 max-w-4xl">
                  <SupplierForm initial={selected} submitLabel="Save changes" onSubmit={v => { void run(() => api('/api/admin/pos/consignors', { method: 'PATCH', body: JSON.stringify({ id: selected.id, ...v }) }), 'Saved') }} />
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <button type="button" onClick={() => run(() => api('/api/admin/pos/consignors', { method: 'PATCH', body: JSON.stringify({ id: selected.id, is_active: !selected.is_active }) }), 'Updated')} className={`h-9 px-3 rounded-lg text-xs font-semibold border ${selected.is_active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-500'}`}>{selected.is_active ? 'Active' : 'Inactive'}</button>
                    <button type="button" onClick={() => { if (confirm(`Delete supplier ${selected.name}? Only possible when they have no products, sales or statements.`)) void run(() => api(`/api/admin/pos/consignors?id=${selected.id}`, { method: 'DELETE' }), 'Supplier deleted').then(done => { if (done) setSelId('') }) }} className={`${BTN} text-red-700`}><Trash2 className="h-3.5 w-3.5" /> Delete supplier</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

type RunFn = (fn: () => Promise<unknown>, okMsg: string) => Promise<boolean>

function SupplierForm({ initial, submitLabel, onSubmit, onCancel }: { initial?: Consignor; submitLabel: string; onSubmit: (v: Record<string, unknown>) => void; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [type, setType] = useState<'commission' | 'cost'>(initial?.payout_type ?? 'commission')
  const [pct, setPct] = useState(String(initial ? Number(initial.commission_pct) : 20))
  const [bank, setBank] = useState(initial?.bank_name ?? '')
  const [acct, setAcct] = useState(initial?.bank_account ?? '')
  const [holder, setHolder] = useState(initial?.bank_holder ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, phone, payout_type: type, commission_pct: Number(pct), bank_name: bank, bank_account: acct, bank_holder: holder, note }) }} className="grid sm:grid-cols-2 gap-3">
      <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Supplier name</span><input value={name} onChange={e => setName(e.target.value)} required className={`${INPUT} w-full`} placeholder="e.g. Kak Ani Kuih" /></label>
      <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Phone (optional)</span><input value={phone} onChange={e => setPhone(e.target.value)} className={`${INPUT} w-full`} /></label>
      <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">How the supplier is paid</span>
        <select value={type} onChange={e => setType(e.target.value as 'commission' | 'cost')} className={`${INPUT} w-full`}>
          <option value="commission">Commission — store keeps a % of each sale</option>
          <option value="cost">Cost — pay a fixed cost per unit sold</option>
        </select>
      </label>
      {type === 'commission'
        ? <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Store commission (%)</span><input value={pct} onChange={e => setPct(e.target.value)} inputMode="decimal" className={`${INPUT} w-32`} /><span className="block text-xs text-gray-400 mt-1">Sale RM10 at {Number(pct) || 0}% → supplier gets RM{(10 * (1 - (Number(pct) || 0) / 100)).toFixed(2)}.</span></label>
        : <p className="text-xs text-gray-500 self-end pb-2">Set the cost for each product in the Products tab. Your margin = selling price − cost.</p>}
      <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Bank (optional)</span><input value={bank} onChange={e => setBank(e.target.value)} className={`${INPUT} w-full`} placeholder="e.g. Maybank" /></label>
      <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Account number (optional)</span><input value={acct} onChange={e => setAcct(e.target.value)} className={`${INPUT} w-full`} /></label>
      <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Account holder (optional)</span><input value={holder} onChange={e => setHolder(e.target.value)} className={`${INPUT} w-full`} /></label>
      <label className="block"><span className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</span><input value={note} onChange={e => setNote(e.target.value)} className={`${INPUT} w-full`} placeholder="e.g. settle every Friday" /></label>
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-gray-300 text-sm font-semibold">Cancel</button>}
      </div>
    </form>
  )
}

function SalesTab({ c, d, today, from, to, setFrom, setTo, run }: { c: ConsignorRow; d: Detail; today: string; from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; run: RunFn }) {
  const r = d.report
  const firstDay = r?.firstSold ? klDateStr(new Date(r.firstSold)) : today
  const lastDay = r?.lastSold ? klDateStr(new Date(r.lastSold)) : today
  const create = () => {
    const pf = from || firstDay, pt = to || lastDay
    if (!confirm(`Create a statement for ${c.name}, ${pf} to ${pt}, amount owed ${money(r?.totals.payable ?? 0)}? These sales will be marked as settled.`)) return
    void run(() => api('/api/admin/pos/consign-settlements', { method: 'POST', body: JSON.stringify({ consignor_id: c.id, from: pf, to: pt }) }).then(j => { window.open(`/pos/consign/${j.settlement.id}?print=1`, '_blank', 'noopener') }), 'Statement created')
  }
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Unsettled sales</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} aria-label="From" className="h-9 px-2 rounded-lg border border-gray-300 text-sm" />
            <span className="text-gray-400">–</span>
            <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} aria-label="To" className="h-9 px-2 rounded-lg border border-gray-300 text-sm" />
            {(from || to) && <button type="button" onClick={() => { setFrom(''); setTo('') }} className={BTN}>All dates</button>}
            <button type="button" onClick={() => run(() => api('/api/admin/pos/consign-report', { method: 'POST', body: JSON.stringify({ consignor_id: c.id, action: 'recalculate' }) }), 'Recalculated with current terms')} className={BTN} title="Re-apply the current terms to sales not yet on a statement (e.g. after setting a cost, or for sales made before the product was linked)"><RefreshCw className="h-3.5 w-3.5" /> Recalculate</button>
          </div>
        </div>
        {r && r.totals.missingCost > 0 && <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">{r.totals.missingCost} sale {r.totals.missingCost === 1 ? 'line has' : 'lines have'} no cost set. Enter the cost in the Products tab, then press Recalculate.</div>}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty sold</th><th className="px-3 py-2 text-right">Sales</th><th className="px-3 py-2 text-right">Owed to supplier</th><th className="px-3 py-2 text-right">Store keeps</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(r?.rows ?? []).map(x => (
                <tr key={x.key}>
                  <td className="px-3 py-2 text-gray-800">{x.name}{x.variant && <span className="text-gray-500"> · {x.variant}</span>}{x.missingCost > 0 && <span className="ml-1 text-[10px] font-bold text-amber-700 uppercase">cost missing</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQty(x.qty, x.unit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(x.sales)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(x.payable)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{money(x.commission)}</td>
                </tr>
              ))}
              {(r?.rows.length ?? 0) === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No unsettled sales{from || to ? ' in this period' : ''}. Sales appear here after a linked product is sold.</td></tr>}
            </tbody>
            {r && r.rows.length > 0 && <tfoot className="bg-gray-50 font-semibold"><tr><td className="px-3 py-2">Total · {r.totals.lines} sale {r.totals.lines === 1 ? 'line' : 'lines'}</td><td /><td className="px-3 py-2 text-right tabular-nums">{money(r.totals.sales)}</td><td className="px-3 py-2 text-right tabular-nums">{money(r.totals.payable)}</td><td className="px-3 py-2 text-right tabular-nums">{money(r.totals.commission)}</td></tr></tfoot>}
          </table>
        </div>
        {r && r.rows.length > 0 && <div className="mt-3 flex justify-end"><button type="button" onClick={create} disabled={r.totals.missingCost > 0} className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Check className="h-4 w-4" /> Create statement · {money(r.totals.payable)}</button></div>}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Statements</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">No.</th><th className="px-3 py-2">Period</th><th className="px-3 py-2 text-right">Sales</th><th className="px-3 py-2 text-right">Owed</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {d.settlements.map(s => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{s.doc_no}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.period_from} – {s.period_to}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(Number(s.sales_total))}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{money(Number(s.payable_total))}</td>
                  <td className="px-3 py-2"><span className={`inline-flex h-6 px-2 items-center rounded-md border text-[11px] font-bold uppercase ${s.status === 'paid' ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-gray-900 text-white border-gray-900'}`}>{s.status}</span>{s.status === 'paid' && s.paid_at && <span className="block text-[11px] text-gray-400">{fmtKl(s.paid_at)}{s.pay_ref ? ` · ${s.pay_ref}` : ''}</span>}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <a href={`/pos/consign/${s.id}?print=1`} target="_blank" rel="noreferrer" className={BTN}><Printer className="h-3.5 w-3.5" /> Print</a>
                    {s.status === 'unpaid'
                      ? <><button type="button" onClick={() => { const ref = prompt('Payment reference (optional) — e.g. bank transfer ref:'); if (ref !== null) void run(() => api('/api/admin/pos/consign-settlements', { method: 'PATCH', body: JSON.stringify({ id: s.id, action: 'paid', pay_ref: ref }) }), 'Marked as paid') }} className={`${BTN} ml-1`}><Check className="h-3.5 w-3.5" /> Mark paid</button>
                          <button type="button" onClick={() => { if (confirm(`Delete statement ${s.doc_no}? Its sales go back to Unsettled.`)) void run(() => api(`/api/admin/pos/consign-settlements?id=${s.id}`, { method: 'DELETE' }), 'Statement deleted') }} className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-red-50 text-red-700" aria-label="Delete statement"><Trash2 className="h-4 w-4" /></button></>
                      : <button type="button" onClick={() => { if (confirm(`Mark ${s.doc_no} as unpaid again?`)) void run(() => api('/api/admin/pos/consign-settlements', { method: 'PATCH', body: JSON.stringify({ id: s.id, action: 'unpaid' }) }), 'Marked as unpaid') }} className={`${BTN} ml-1`}><Undo2 className="h-3.5 w-3.5" /> Unpaid</button>}
                  </td>
                </tr>
              ))}
              {d.settlements.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No statements yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ProductsTab({ c, d, all, run }: { c: ConsignorRow; d: Detail; all: AllProduct[]; run: RunFn }) {
  const [q, setQ] = useState('')
  const linked = useMemo(() => new Set(d.products.map(p => p.product_id)), [d.products])
  const results = useMemo(() => { const s = q.trim().toLowerCase(); return s ? all.filter(p => !linked.has(p.id) && p.name.toLowerCase().includes(s)).slice(0, 10) : [] }, [q, all, linked])
  const patch = (body: Record<string, unknown>, msg: string) => run(() => api('/api/admin/pos/consign-products', { method: 'PATCH', body: JSON.stringify(body) }), msg)
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{c.payout_type === 'commission' ? `Each sale of these products keeps ${Number(c.commission_pct)}% for the store unless a product has its own %.` : 'Enter what you pay the supplier per unit. Products with sizes take a cost per size; the top box is the default and the per-kg cost for weighed sales.'} Changing terms affects new sales only; press Recalculate in Sales &amp; statements to re-apply to unsettled sales.</p>
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a product to link to this supplier…" className={`${INPUT} w-full pl-9`} />
        {results.length > 0 && <ul className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg text-sm">
          {results.map(p => <li key={p.id}><button type="button" onClick={() => { setQ(''); void patch({ product_id: p.id, consignor_id: c.id }, `${p.name} linked`) }} className="w-full text-left px-3 py-2 hover:bg-gray-50"><span className="font-semibold">{p.name}</span><span className="text-gray-400"> · {p.category ?? 'no category'}</span></button></li>)}
        </ul>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Selling price</th><th className="px-3 py-2">{c.payout_type === 'commission' ? 'Store commission' : 'Cost paid to supplier'}</th><th className="px-3 py-2"></th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {d.products.map(p => (
              <tr key={p.product_id} className="align-top">
                <td className="px-3 py-2 font-semibold text-gray-900">{p.name}<span className="block text-xs font-normal text-gray-400">{p.category ?? '—'}</span></td>
                <td className="px-3 py-2 text-gray-600 tabular-nums">{p.variants.length ? p.variants.map(v => <span key={v.id} className="block">{v.name} · {money(v.price)}</span>) : `${money(p.price)}${p.unit ? `/${p.unit}` : ''}`}</td>
                <td className="px-3 py-2">
                  {c.payout_type === 'commission'
                    ? <div className="flex items-center gap-1 text-xs"><NumBox value={p.commission_pct} placeholder={`${Number(c.commission_pct)} (default)`} onCommit={v => { void patch({ product_id: p.product_id, commission_pct: v }, 'Saved') }} /> %</div>
                    : <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1"><span className="w-28 text-gray-500">{p.variants.length ? 'Default / per kg' : 'Per unit'}</span>RM <NumBox value={p.cost} placeholder="0.00" onCommit={v => { void patch({ product_id: p.product_id, cost: v }, 'Saved') }} /></div>
                        {p.variants.map(v => <div key={v.id} className="flex items-center gap-1"><span className="w-28 truncate text-gray-500">{v.name}</span>RM <NumBox value={v.cost} placeholder={p.cost != null ? String(p.cost) : '0.00'} onCommit={val => { void patch({ product_id: p.product_id, variant_costs: [{ variant_id: v.id, cost: val }] }, 'Saved') }} /></div>)}
                      </div>}
                </td>
                <td className="px-3 py-2 text-right"><button type="button" onClick={() => { if (confirm(`Unlink ${p.name} from ${c.name}? Past sales keep their consignment record.`)) void patch({ product_id: p.product_id, consignor_id: null }, 'Unlinked') }} className={`${BTN} text-red-700`}><Trash2 className="h-3.5 w-3.5" /> Unlink</button></td>
              </tr>
            ))}
            {d.products.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-400">No products linked yet. Add the product in Admin → Products first, then search for it above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StockTab({ c, d, run }: { c: ConsignorRow; d: Detail; run: RunFn }) {
  const [pid, setPid] = useState('')
  const [vid, setVid] = useState('')
  const [qty, setQty] = useState('')
  const [type, setType] = useState<'in' | 'return'>('in')
  const [note, setNote] = useState('')
  const [adjust, setAdjust] = useState(true)
  const product = d.products.find(p => p.product_id === pid)
  const unit: 'pcs' | 'kg' = vid === 'kg' ? 'kg' : 'pcs'
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pid) { toast.error('Choose a product'); return }
    if (product && product.variants.length > 0 && !vid) { toast.error('Choose a size'); return }
    void run(() => api('/api/admin/pos/consign-stock', { method: 'POST', body: JSON.stringify({ consignor_id: c.id, product_id: pid, variant_id: vid && vid !== 'kg' ? vid : null, unit, qty: Number(qty), type, note, adjust_stock: adjust }) }).then(j => { if (j.stockNote) toast.message(j.stockNote) }), type === 'in' ? 'Stock received' : 'Return recorded').then(done => { if (done) { setQty(''); setNote('') } })
  }
  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="rounded-lg border border-gray-200 p-3 space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Record stock from / back to the supplier</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select value={type} onChange={e => setType(e.target.value as 'in' | 'return')} className={INPUT}><option value="in">Stock in (received)</option><option value="return">Return to supplier</option></select>
          <select value={pid} onChange={e => { setPid(e.target.value); setVid('') }} className={`${INPUT} min-w-52`}><option value="">— product —</option>{d.products.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}</select>
          {product && <select value={vid} onChange={e => setVid(e.target.value)} className={INPUT}>{product.variants.length > 0 ? <option value="">— size —</option> : <option value="">Per unit</option>}{product.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}<option value="kg">By weight (kg)</option></select>}
          <input value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal" placeholder={unit === 'kg' ? 'kg' : 'Qty'} required className={`${INPUT} w-24`} />
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className={`${INPUT} flex-1 min-w-40`} />
          <button type="submit" className="h-10 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold">Save</button>
        </div>
        <label className={`inline-flex items-center gap-2 text-xs ${unit === 'kg' ? 'text-gray-400' : 'text-gray-600'}`}><input type="checkbox" checked={adjust && unit !== 'kg'} disabled={unit === 'kg'} onChange={e => setAdjust(e.target.checked)} className="h-4 w-4" /> Also update the store stock for this item{unit === 'kg' ? ' (weighed items are not stock-tracked at the store)' : ''}</label>
        {d.products.length === 0 && <p className="text-xs text-amber-800">Link products to this supplier first (Products tab).</p>}
      </form>
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Supplier&apos;s stock at your store</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right">Returned</th><th className="px-3 py-2 text-right">Sold</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {d.balance.map(b => <tr key={b.key}><td className="px-3 py-2">{b.name}{b.variant && <span className="text-gray-500"> · {b.variant}</span>}{b.unit === 'kg' && !b.variant && <span className="text-gray-500"> · by weight</span>}</td><td className="px-3 py-2 text-right tabular-nums">{fmtQty(b.received, b.unit)}</td><td className="px-3 py-2 text-right tabular-nums">{fmtQty(b.returned, b.unit)}</td><td className="px-3 py-2 text-right tabular-nums">{fmtQty(b.sold, b.unit)}</td><td className={`px-3 py-2 text-right tabular-nums font-semibold ${b.balance < 0 ? 'text-amber-700' : 'text-gray-900'}`}>{fmtQty(b.balance, b.unit)}</td></tr>)}
                {d.balance.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Nothing recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-1">Balance = received − returned − sold. A negative balance means more was sold than recorded as received.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">History</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 sticky top-0"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2">Note</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {d.moves.map(m => <tr key={m.id}><td className="px-3 py-1.5 text-xs text-gray-500 whitespace-nowrap">{fmtKl(m.created_at)}</td><td className="px-3 py-1.5 text-xs font-semibold">{m.type === 'in' ? 'Stock in' : 'Return'}</td><td className="px-3 py-1.5">{m.name}{m.variant && <span className="text-gray-500"> · {m.variant}</span>}</td><td className="px-3 py-1.5 text-right tabular-nums font-semibold">{m.type === 'return' ? '−' : '+'}{fmtQty(m.qty, m.unit)}</td><td className="px-3 py-1.5 text-xs text-gray-500">{m.note ?? ''}</td></tr>)}
                {d.moves.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No stock movements yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function NumBox({ value, placeholder, onCommit }: { value: number | null; placeholder?: string; onCommit: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? '' : String(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) { setPrev(value); setV(value == null ? '' : String(value)) }
  return <input value={v} onChange={e => setV(e.target.value)} inputMode="decimal" placeholder={placeholder} onBlur={() => { const n = v.trim() === '' ? null : Number(v); if (n !== value && (n === null || Number.isFinite(n))) onCommit(n) }} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="h-8 w-28 px-2 rounded-md border border-gray-200 text-sm tabular-nums" />
}
