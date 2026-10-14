'use client'

// Manual gift order key-in (admin). Pick box/fillings/design/qty from the catalog,
// optionally override the quoted total, set deposit %. POSTs to /api/admin/kurma/orders.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { quoteGift, depositFor, boxSupportsWeight, WEIGHTS, FINISHES, type GiftBox, type GiftFilling, type GiftDesign, type GiftCatalog } from '@/lib/gift'

const inp = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1'
const rm = (n: unknown) => `RM${Number(n ?? 0).toFixed(2)}`

export function NewGiftOrderClient() {
  const router = useRouter()
  const [cat, setCat] = useState<GiftCatalog>({ boxes: [], fillings: [], designs: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [f, setF] = useState({ name: '', phone: '', email: '', company: '', address: '', postcode: '', delivery_method: 'delivery', notes: '', admin_notes: '' })
  const [weight, setWeight] = useState(''); const [boxId, setBoxId] = useState(''); const [finishing, setFinishing] = useState('matte'); const [designId, setDesignId] = useState(''); const [quantity, setQuantity] = useState('1')
  const [fillings, setFillings] = useState<{ id: string; qty: number }[]>([])
  const [depositPct, setDepositPct] = useState('50'); const [totalOverride, setTotalOverride] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/kurma/catalog'); const j = await res.json().catch(() => ({}))
    setCat({ boxes: j.boxes ?? [], fillings: j.fillings ?? [], designs: j.designs ?? [] }); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const quote = useMemo(() => quoteGift(cat, { box_id: boxId, weight: weight || null, finishing: finishing || null, design_id: designId || null, fillings, quantity: Number(quantity) || 1 }), [cat, boxId, weight, finishing, designId, fillings, quantity])
  const total = totalOverride !== '' ? Number(totalOverride) : (quote.ok ? quote.subtotal : 0)
  const { deposit, balance } = depositFor(total, Math.min(100, Math.max(10, Number(depositPct) || 50)))
  const boxOptions = weight ? cat.boxes.filter((b: GiftBox) => boxSupportsWeight(b, weight)) : cat.boxes
  const boxDesigns = cat.designs.filter((d: GiftDesign) => !d.box_id || d.box_id === boxId)

  async function submit(status: 'quoted' | 'confirmed') {
    if (f.name.trim().length < 2 || f.phone.replace(/\D/g, '').length < 8) { toast.error('Name & phone required'); return }
    if (!boxId) { toast.error('Pick a box'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/kurma/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, config: { box_id: boxId, weight: weight || null, finishing: finishing || null, design_id: designId || null, fillings, quantity: Number(quantity) || 1 }, total: totalOverride !== '' ? Number(totalOverride) : undefined, deposit_pct: Number(depositPct) || 50, status }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Failed'); return }
      toast.success('Order created'); router.push(`/admin/kurma/${j.id}`)
    } finally { setSaving(false) }
  }

  if (loading) return <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>

  return (
    <div className="space-y-4">
      <Link href="/admin/kurma" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft className="h-4 w-4" />Gift Orders</Link>
      <h1 className="text-xl font-bold text-gray-900">New gift order (manual)</h1>

      {/* Customer */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 grid grid-cols-2 gap-3">
        <div><label className={lbl}>Name *</label><input className={inp} value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} /></div>
        <div><label className={lbl}>Phone *</label><input className={inp} value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} /></div>
        <div><label className={lbl}>Email</label><input className={inp} value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} /></div>
        <div><label className={lbl}>Company</label><input className={inp} value={f.company} onChange={e => setF(s => ({ ...s, company: e.target.value }))} /></div>
        <div><label className={lbl}>Delivery</label>
          <select className={inp} value={f.delivery_method} onChange={e => setF(s => ({ ...s, delivery_method: e.target.value }))}><option value="delivery">Delivery</option><option value="pickup">Pickup</option></select>
        </div>
        <div><label className={lbl}>Postcode</label><input className={inp} value={f.postcode} onChange={e => setF(s => ({ ...s, postcode: e.target.value }))} /></div>
        <div className="col-span-2"><label className={lbl}>Address</label><input className={inp} value={f.address} onChange={e => setF(s => ({ ...s, address: e.target.value }))} /></div>
      </div>

      {/* Config */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lbl}>Weight</label>
            <select className={inp} value={weight} onChange={e => { setWeight(e.target.value); const b = cat.boxes.find(x => x.id === boxId); if (b && !boxSupportsWeight(b, e.target.value)) setBoxId('') }}>
              <option value="">— any —</option>
              {WEIGHTS.map(w => <option key={w.code} value={w.code}>{w.label}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Box *</label>
            <select className={inp} value={boxId} onChange={e => { setBoxId(e.target.value); setDesignId('') }}>
              <option value="">— pick —</option>
              {boxOptions.map((b: GiftBox) => <option key={b.id} value={b.id}>{b.name} ({rm(b.base_price)})</option>)}
            </select>
          </div>
          <div><label className={lbl}>Design</label>
            <select className={inp} value={designId} onChange={e => setDesignId(e.target.value)}>
              <option value="">None / custom later</option>
              {boxDesigns.map(d => <option key={d.id} value={d.id}>{d.name}{d.price_add ? ` (+${rm(d.price_add)})` : ''}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Finishing</label>
            <select className={inp} value={finishing} onChange={e => setFinishing(e.target.value)}>
              {FINISHES.map(fin => <option key={fin.code} value={fin.code}>{fin.label}{fin.price_add ? ` (+${rm(fin.price_add)})` : ''}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={lbl}>Fillings</label>
          <div className="space-y-2">
            {fillings.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <select className={`${inp} flex-1`} value={row.id} onChange={e => setFillings(fs => fs.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}>
                  <option value="">— filling —</option>
                  {cat.fillings.map((fl: GiftFilling) => <option key={fl.id} value={fl.id}>{fl.name} ({rm(fl.price)}/{fl.unit})</option>)}
                </select>
                <input type="number" min="1" className={`${inp} w-20`} value={row.qty} onChange={e => setFillings(fs => fs.map((x, j) => j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x))} />
                <button onClick={() => setFillings(fs => fs.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={() => setFillings(fs => [...fs, { id: '', qty: 1 }])} className="text-xs font-semibold text-gray-600 border border-dashed border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50"><Plus className="h-3.5 w-3.5 inline" /> Add filling</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lbl}>Quantity (units)</label><input type="number" min="1" className={`${inp} font-mono`} value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
          <div><label className={lbl}>Deposit %</label><input type="number" min="10" max="100" className={`${inp} font-mono`} value={depositPct} onChange={e => setDepositPct(e.target.value)} /></div>
          <div><label className={lbl}>Total override (RM)</label><input type="number" step="0.01" className={`${inp} font-mono`} value={totalOverride} onChange={e => setTotalOverride(e.target.value)} placeholder={quote.ok ? quote.subtotal.toFixed(2) : ''} /></div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between text-sm">
        <div className="text-gray-600">Computed: {quote.ok ? `${rm(quote.unitPrice)} × ${quote.quantity}` : 'pick a box'}</div>
        <div className="text-right"><div className="font-black text-lg text-gray-900">{rm(total)}</div><div className="text-xs text-gray-500">deposit {rm(deposit)} · balance {rm(balance)}</div></div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => submit('quoted')} disabled={saving} className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50">Save as quote</button>
        <button onClick={() => submit('confirmed')} disabled={saving} className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'Create & confirm'}</button>
      </div>
    </div>
  )
}
