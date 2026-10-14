'use client'

// Gift order detail — config summary, quote (total/deposit/balance + pay-links),
// status lifecycle, admin notes, delivery. Migration 137 · lib/gift.ts.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, Copy, ExternalLink, Save } from 'lucide-react'
import { GIFT_STATUSES, finishLabel } from '@/lib/gift'
import { QuotePanel } from './quote-panel'

interface Order {
  id: string; order_number: string; channel: string; status: string; payment_status: string
  name: string; phone: string; email: string | null; company: string | null
  address: string | null; postcode: string | null; delivery_method: string; tracking_number: string | null
  config: {
    box_id?: string; weight?: string | null; finishing?: string | null; design_id?: string | null; custom_design_url?: string | null; fillings?: { id: string; qty: number }[]; quantity?: number
    // Order dari Studio (/kurma/studio) — pilihan sheet 2026 (migration 143)
    source?: 'sheet'; kurma_id?: string; kurma_name?: string; requested_qty?: number
    template_id?: string | null; template_name?: string | null; logo_url?: string | null; mockup_url?: string | null; full_design_url?: string | null; source_utm?: string | null
  }
  custom_design_url: string | null
  quantity: number; unit_price: number; subtotal: number; total: number
  deposit_pct: number; deposit_amount: number; balance: number
  list_unit_price?: number | null; cost_unit?: number | null; margin_pct?: number | null
  notes: string | null; admin_notes: string | null; created_at: string
}
interface CatItem { id: string; name: string }
interface Catalog { boxes: CatItem[]; fillings: CatItem[]; designs: CatItem[] }

const rm = (n: unknown) => `RM${Number(n ?? 0).toFixed(2)}`
const NEXT: Record<string, { to: string; label: string }> = {
  enquiry: { to: 'quoted', label: 'Mark quoted' },
  quoted: { to: 'confirmed', label: 'Confirm' },
  confirmed: { to: 'in_production', label: 'Start production' },
  in_production: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'completed', label: 'Mark completed' },
}
const label = (s: string) => GIFT_STATUSES.find(x => x.id === s)?.label ?? s

export function GiftOrderDetail({ id }: { id: string }) {
  const [o, setO] = useState<Order | null>(null)
  const [cat, setCat] = useState<Catalog>({ boxes: [], fillings: [], designs: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  // editable drafts
  const [total, setTotal] = useState(''); const [pct, setPct] = useState(''); const [adminNotes, setAdminNotes] = useState('')
  const [tracking, setTracking] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [ores, cres] = await Promise.all([
      fetch(`/api/admin/kurma/orders/${id}`).then(r => r.json()),
      fetch('/api/admin/kurma/catalog').then(r => r.json()),
    ])
    if (ores?.id) {
      setO(ores); setTotal(String(ores.total)); setPct(String(ores.deposit_pct))
      setAdminNotes(ores.admin_notes ?? ''); setTracking(ores.tracking_number ?? '')
    }
    setCat({ boxes: cres.boxes ?? [], fillings: cres.fillings ?? [], designs: cres.designs ?? [] })
    setLoading(false)
  }, [id])
  useEffect(() => { load() }, [load])

  async function patch(body: Record<string, unknown>, key: string) {
    setBusy(key)
    try {
      const res = await fetch(`/api/admin/kurma/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Failed'); return }
      toast.success('Saved'); await load()
    } finally { setBusy(null) }
  }
  function copyLink(kind: 'deposit' | 'balance') {
    const url = `${location.origin}/api/kurma/pay/${id}?kind=${kind}`
    navigator.clipboard.writeText(url).then(() => toast.success(`${kind === 'deposit' ? 'Deposit' : 'Balance'} pay-link copied`)).catch(() => toast.error('Copy failed'))
  }

  if (loading) return <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
  if (!o) return <p className="text-sm text-gray-500">Order not found. <Link href="/admin/kurma" className="text-red-600">Back</Link></p>

  const boxName = cat.boxes.find(b => b.id === o.config?.box_id)?.name ?? '—'
  const designName = o.config?.design_id ? (cat.designs.find(d => d.id === o.config!.design_id)?.name ?? '—') : (o.custom_design_url ? 'Custom upload' : 'None')
  const fillings = (o.config?.fillings ?? []).map(f => ({ name: cat.fillings.find(x => x.id === f.id)?.name ?? f.id, qty: f.qty }))
  const next = NEXT[o.status]
  const isSheet = o.config?.source === 'sheet'   // order Studio → panel quote senarai-vs-kos
  const thumb = 'h-20 rounded-lg border border-gray-200 object-contain bg-gray-50'
  const box = 'bg-white border border-gray-200 rounded-2xl p-4'
  const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'

  return (
    <div className="space-y-4">
      <Link href="/admin/kurma" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="h-4 w-4" />Gift Orders</Link>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-mono">{o.order_number}</h1>
          <p className="text-sm text-gray-500">{new Date(o.created_at).toLocaleString('en-MY')} · {o.channel}</p>
        </div>
        <div className="flex items-center gap-2">
          {next && <button onClick={() => patch({ status: next.to }, 'status')} disabled={busy === 'status'} className="px-3 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50">{next.label}</button>}
          {o.status !== 'cancelled' && o.status !== 'completed' && <button onClick={() => { if (confirm('Cancel this order?')) patch({ status: 'cancelled' }, 'cancel') }} className="px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">Cancel</button>}
        </div>
      </div>

      {/* Customer */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Customer</p>
        <p className="font-semibold text-gray-900">{o.name} · {o.phone}</p>
        {(o.email || o.company) && <p className="text-sm text-gray-500">{[o.email, o.company].filter(Boolean).join(' · ')}</p>}
        <p className="text-sm text-gray-500 mt-1">{o.delivery_method === 'pickup' ? 'Pickup' : `Deliver to: ${o.address ?? '—'}${o.postcode ? `, ${o.postcode}` : ''}`}</p>
        {o.notes && <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-2">Customer note: {o.notes}</p>}
      </div>

      {/* Configuration */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Configuration{isSheet && <span className="ml-2 normal-case tracking-normal text-[10px] font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded">Studio</span>}</p>
        {isSheet ? (
          <>
            <dl className="text-sm grid grid-cols-2 gap-y-1.5">
              <dt className="text-gray-500">Kurma</dt><dd className="text-gray-900 font-medium text-right">{o.config.kurma_name ?? o.config.kurma_id ?? '—'}</dd>
              <dt className="text-gray-500">Berat</dt><dd className="text-gray-900 text-right">{o.config.weight ?? '—'}</dd>
              <dt className="text-gray-500">Kuantiti</dt><dd className="text-gray-900 font-medium text-right">{o.quantity} kotak{o.config.requested_qty && o.config.requested_qty !== o.quantity ? <span className="text-gray-400 font-normal"> (diminta {o.config.requested_qty})</span> : null}</dd>
              <dt className="text-gray-500">Finishing</dt><dd className="text-gray-900 text-right">{o.config.finishing ? finishLabel(o.config.finishing) : '—'}</dd>
              <dt className="text-gray-500">Template</dt><dd className="text-gray-900 text-right">{o.config.template_name ?? (o.config.full_design_url ? 'Design penuh customer' : 'Tiada — kami reka')}</dd>
              {o.config.source_utm && <><dt className="text-gray-500">Sumber</dt><dd className="text-gray-600 text-right text-xs">{o.config.source_utm}</dd></>}
            </dl>
            {(o.config.mockup_url || o.config.logo_url || o.config.full_design_url) && (
              <div className="flex flex-wrap gap-3 mt-3">
                {([['Mockup', o.config.mockup_url], ['Logo', o.config.logo_url], ['Design penuh', o.config.full_design_url]] as const).filter(([, u]) => !!u).map(([label, u]) => (
                  <a key={label} href={u!} target="_blank" rel="noreferrer" className="group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {/\.pdf($|\?)/i.test(u!) ? <div className={`${thumb} w-20 grid place-items-center text-[11px] font-bold text-gray-500`}>PDF</div> : <img src={u!} alt={label} className={thumb} />}
                    <div className="text-[11px] text-gray-500 mt-1 inline-flex items-center gap-1 group-hover:text-gray-800">{label}<ExternalLink className="h-3 w-3" /></div>
                  </a>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <dl className="text-sm grid grid-cols-2 gap-y-1.5">
              <dt className="text-gray-500">Box</dt><dd className="text-gray-900 font-medium text-right">{boxName}</dd>
              <dt className="text-gray-500">Weight</dt><dd className="text-gray-900 text-right">{o.config?.weight ?? '—'}</dd>
              <dt className="text-gray-500">Finishing</dt><dd className="text-gray-900 text-right">{o.config?.finishing ? finishLabel(o.config.finishing) : '—'}</dd>
              <dt className="text-gray-500">Design</dt><dd className="text-gray-900 text-right">{designName}</dd>
              <dt className="text-gray-500">Fillings</dt><dd className="text-gray-900 text-right">{fillings.length ? fillings.map(f => `${f.name}×${f.qty}`).join(', ') : '—'}</dd>
              <dt className="text-gray-500">Quantity</dt><dd className="text-gray-900 font-medium text-right">{o.quantity} units</dd>
            </dl>
            {o.custom_design_url && <a href={o.custom_design_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 mt-2"><ExternalLink className="h-3.5 w-3.5" />Customer design file</a>}
          </>
        )}
      </div>

      {/* Quote + payment — order Studio guna panel senarai-vs-kos; order lain kekal panel asal */}
      {isSheet ? (
        <QuotePanel order={o} patch={patch} copyLink={copyLink} busy={busy} />
      ) : (
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">Quote & payment</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div><label className="block text-xs text-gray-600 mb-1">Total (RM)</label><input type="number" step="0.01" value={total} onChange={e => setTotal(e.target.value)} className={`${inp} w-full font-mono`} /></div>
          <div><label className="block text-xs text-gray-600 mb-1">Deposit %</label><input type="number" min="10" max="100" value={pct} onChange={e => setPct(e.target.value)} className={`${inp} w-full font-mono`} /></div>
          <div className="text-sm"><span className="block text-xs text-gray-500">Deposit</span><span className="font-bold text-gray-900">{rm(o.deposit_amount)}</span></div>
          <div className="text-sm"><span className="block text-xs text-gray-500">Balance</span><span className="font-bold text-gray-900">{rm(o.balance)}</span></div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={() => patch({ total: Number(total), deposit_pct: Number(pct) }, 'quote')} disabled={busy === 'quote'} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50">{busy === 'quote' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save quote</button>
          <span className="text-xs text-gray-400 mr-auto">Payment: <b className="text-gray-700">{o.payment_status.replace('_', ' ')}</b></span>
          <button onClick={() => copyLink('deposit')} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50"><Copy className="h-3.5 w-3.5" />Deposit link</button>
          <button onClick={() => copyLink('balance')} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50"><Copy className="h-3.5 w-3.5" />Balance link</button>
        </div>
      </div>
      )}

      {/* Fulfilment */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Fulfilment</p>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px]"><label className="block text-xs text-gray-600 mb-1">Tracking / pickup ref</label><input value={tracking} onChange={e => setTracking(e.target.value)} className={`${inp} w-full`} /></div>
          <button onClick={() => patch({ tracking_number: tracking }, 'track')} disabled={busy === 'track'} className="px-3 py-1.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">Save</button>
          <span className="text-xs text-gray-400">Current status: <b className="text-gray-700">{label(o.status)}</b></span>
        </div>
      </div>

      {/* Admin notes */}
      <div className={box}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Admin notes</p>
        <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} className={`${inp} w-full`} placeholder="Internal notes…" />
        <button onClick={() => patch({ admin_notes: adminNotes }, 'notes')} disabled={busy === 'notes'} className="mt-2 px-3 py-1.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50">Save notes</button>
      </div>
    </div>
  )
}
