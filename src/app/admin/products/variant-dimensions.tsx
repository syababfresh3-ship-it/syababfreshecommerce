'use client'

// TikTok-Shop-style variation options (migration 136): define options (e.g. Size, Promo)
// and their values, then "Create combinations" — every combination becomes one variation
// row in the list below (edit its price/stock there, like TikTok's Variation list).
// Products without options keep the flat variation list. See src/lib/variant-options.ts.
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, X, Layers, ChevronRight } from 'lucide-react'
import { generateCombos, MAX_DIMENSIONS, parseVariantOptions, type VariantOption } from '@/lib/variant-options'

const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white'

export function VariantDimensions({ productId, onGenerated }: { productId: string; onGenerated: () => void }) {
  const [dims, setDims] = useState<VariantOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<number, string>>({})   // pending value input per option
  const [defaults, setDefaults] = useState({ price: '', compare_price: '', stock: '0' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/products/${productId}/variants/generate`).then(r => r.json()).then(j => {
      const d = parseVariantOptions(j.dims); setDims(d); setOpen(d.length > 0)
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [productId])

  const combos = generateCombos(dims).length
  const ready = dims.length > 0 && dims.every(d => d.name.trim() && d.values.length > 0)

  function addDim() { if (dims.length < MAX_DIMENSIONS) setDims(d => [...d, { name: '', values: [] }]) }
  function setName(i: number, name: string) { setDims(d => d.map((x, j) => j === i ? { ...x, name } : x)) }
  function removeDim(i: number) { setDims(d => d.filter((_, j) => j !== i)) }
  function addValue(i: number) {
    const raw = (draft[i] ?? '').trim(); if (!raw) return
    // Paste several values at once, separated by commas
    const vals = raw.split(',').map(s => s.trim()).filter(Boolean)
    setDims(d => d.map((x, j) => j === i ? { ...x, values: [...x.values, ...vals.filter(v => !x.values.some(e => e.toLowerCase() === v.toLowerCase()))] } : x))
    setDraft(s => ({ ...s, [i]: '' }))
  }
  function removeValue(i: number, v: string) { setDims(d => d.map((x, j) => j === i ? { ...x, values: x.values.filter(e => e !== v) } : x)) }

  async function generate() {
    const clean = parseVariantOptions(dims)
    if (clean.length === 0) { toast.error('Add at least one option with some values'); return }
    if (!window.confirm(`Create ${generateCombos(clean).length} combinations? Existing ones stay as they are (price/stock unchanged); new ones use the default price below.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dims: clean, defaults }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Could not create combinations'); return }
      setDims(j.dims ?? clean)
      const parts = [`${j.combos} combination${j.combos > 1 ? 's' : ''}`]
      if (j.inserted) parts.push(`${j.inserted} new`)
      if (j.updated) parts.push(`${j.updated} updated`)
      if (j.deactivated) parts.push(`${j.deactivated} hidden`)
      toast.success(parts.join(' · '))
      onGenerated()
    } finally { setBusy(false) }
  }

  if (!loaded) return null

  // Collapsed intro card — invite to set up options
  if (!open) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Layers className="h-4 w-4" />Variation options</p>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Sell one product with two choices — like <span className="font-medium text-gray-700">Size</span> and <span className="font-medium text-gray-700">Promo</span>. We create every combination automatically, each with its own price and stock. Leave this off for a simple size list.
          </p>
        </div>
        <button type="button" onClick={() => { setOpen(true); if (dims.length === 0) addDim() }} className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-white bg-gray-900 px-3 py-2 rounded-xl hover:bg-gray-800">
          Set up options <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Layers className="h-4 w-4 text-gray-700" />
        <p className="text-sm font-bold text-gray-900">Variation options</p>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Add each option and its values, then create the combinations. Every combination shows up as a row below where you set its price and stock.
      </p>

      <div className="space-y-3">
        {dims.map((d, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 shrink-0">Option {i + 1}</span>
              <input value={d.name} onChange={e => setName(i, e.target.value)} placeholder="Name — e.g. Size or Promo" className={`${inp} flex-1 font-semibold`} />
              <button type="button" onClick={() => removeDim(i)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Remove option"><X className="h-4 w-4" /></button>
            </div>
            {d.values.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {d.values.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {v}
                    <button type="button" onClick={() => removeValue(i, v)} className="text-gray-400 hover:text-gray-700" aria-label={`Remove ${v}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={draft[i] ?? ''}
                onChange={e => setDraft(s => ({ ...s, [i]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addValue(i) } }}
                placeholder="Add a value, press Enter — or paste “Small, Large, Jumbo”"
                className={`${inp} flex-1`}
              />
              <button type="button" onClick={() => addValue(i)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold shrink-0"><Plus className="h-3.5 w-3.5 inline" /> Add</button>
            </div>
          </div>
        ))}

        {dims.length < MAX_DIMENSIONS && (
          <button type="button" onClick={addDim} className="w-full text-xs font-semibold text-gray-600 border border-dashed border-gray-300 px-3 py-2 rounded-xl hover:bg-white hover:border-gray-400 transition-colors">
            + Add another option ({dims.length} of {MAX_DIMENSIONS})
          </button>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Default price for new combinations</p>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-xs text-gray-600 mb-1">Price (RM) *</label><input type="number" step="0.01" min="0" value={defaults.price} onChange={e => setDefaults(s => ({ ...s, price: e.target.value }))} className={`${inp} w-full font-mono`} placeholder="0.00" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">Was (RM)</label><input type="number" step="0.01" min="0" value={defaults.compare_price} onChange={e => setDefaults(s => ({ ...s, compare_price: e.target.value }))} className={`${inp} w-full font-mono`} placeholder="—" /></div>
            <div><label className="block text-xs text-gray-600 mb-1">Stock</label><input type="number" min="0" value={defaults.stock} onChange={e => setDefaults(s => ({ ...s, stock: e.target.value }))} className={`${inp} w-full font-mono`} /></div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Combinations that already exist keep their own price and stock — you can fine-tune each one in the list below after creating them.</p>
        </div>

        <div className="flex items-center gap-3 pt-0.5">
          <button type="button" onClick={generate} disabled={busy || !ready} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            Create {combos > 0 ? combos : ''} combination{combos !== 1 ? 's' : ''}
          </button>
          {ready
            ? <span className="text-xs text-gray-500">{dims.map(d => `${d.name} (${d.values.length})`).join('  ×  ')}</span>
            : <span className="text-xs text-gray-400">Give each option a name and at least one value</span>}
          {dims.length === 1 && dims[0].values.length === 0 && (
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}
