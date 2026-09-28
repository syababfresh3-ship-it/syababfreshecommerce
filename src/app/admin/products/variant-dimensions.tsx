'use client'

// Dimensi variasi gaya TikTok Shop (migration 136): tetapkan dimensi (cth Saiz, Promo)
// dan nilai masing-masing, kemudian "Jana kombinasi" — setiap kombinasi jadi satu
// baris varian di senarai bawah (harga/stok setiap satu diedit di sana, macam
// "Variation list" TikTok). Produk tanpa dimensi kekal senarai rata seperti dulu.
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, X, Layers } from 'lucide-react'
import { generateCombos, MAX_DIMENSIONS, parseVariantOptions, type VariantOption } from '@/lib/variant-options'

const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white'

export function VariantDimensions({ productId, onGenerated }: { productId: string; onGenerated: () => void }) {
  const [dims, setDims] = useState<VariantOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<number, string>>({})   // input nilai baharu per dimensi
  const [defaults, setDefaults] = useState({ price: '', compare_price: '', stock: '0' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/products/${productId}/variants/generate`).then(r => r.json()).then(j => {
      const d = parseVariantOptions(j.dims); setDims(d); setOpen(d.length > 0)
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [productId])

  const combos = generateCombos(dims).length

  function addDim() { if (dims.length < MAX_DIMENSIONS) setDims(d => [...d, { name: '', values: [] }]) }
  function setName(i: number, name: string) { setDims(d => d.map((x, j) => j === i ? { ...x, name } : x)) }
  function removeDim(i: number) { setDims(d => d.filter((_, j) => j !== i)) }
  function addValue(i: number) {
    const raw = (draft[i] ?? '').trim(); if (!raw) return
    // Boleh tampal beberapa nilai sekali gus dipisah koma
    const vals = raw.split(',').map(s => s.trim()).filter(Boolean)
    setDims(d => d.map((x, j) => j === i ? { ...x, values: [...x.values, ...vals.filter(v => !x.values.some(e => e.toLowerCase() === v.toLowerCase()))] } : x))
    setDraft(s => ({ ...s, [i]: '' }))
  }
  function removeValue(i: number, v: string) { setDims(d => d.map((x, j) => j === i ? { ...x, values: x.values.filter(e => e !== v) } : x)) }

  async function generate() {
    const clean = parseVariantOptions(dims)
    if (clean.length === 0) { toast.error('Isi sekurang-kurangnya satu dimensi dengan nilai'); return }
    if (!window.confirm(`Jana ${generateCombos(clean).length} kombinasi? Kombinasi sedia ada kekal (harga/stok tak diubah); yang baharu guna nilai lalai.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dims: clean, defaults }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Gagal jana'); return }
      setDims(j.dims ?? clean)
      toast.success(`${j.combos} kombinasi · ${j.inserted} baharu · ${j.updated} dikemas kini${j.deactivated ? ` · ${j.deactivated} dinyahaktif` : ''}`)
      onGenerated()
    } finally { setBusy(false) }
  }

  if (!loaded) return null

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><Layers className="h-4 w-4" />Dimensi variasi (gaya TikTok)</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {dims.length > 0
              ? `${dims.map(d => `${d.name || '?'} (${d.values.length})`).join(' × ')} = ${combos} kombinasi. Senarai di bawah ialah kombinasi — edit harga/stok setiap satu di sana.`
              : 'Contoh: Saiz (Small, Large) × Promo (1 biji, 2 biji + FREE 2 biji) → 4 kombinasi, setiap satu harga & stok sendiri.'}
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => { setOpen(true); if (dims.length === 0) addDim() }} className="shrink-0 text-xs font-semibold text-gray-700 border border-gray-300 px-3 py-2 rounded-xl hover:bg-white">
            Guna dimensi
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {dims.map((d, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 w-16">Dimensi {i + 1}</span>
                <input value={d.name} onChange={e => setName(i, e.target.value)} placeholder="cth: Saiz / Promo" className={`${inp} flex-1 font-semibold`} />
                <button type="button" onClick={() => removeDim(i)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Buang dimensi"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {d.values.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {v}
                    <button type="button" onClick={() => removeValue(i, v)} className="text-gray-400 hover:text-gray-700" aria-label={`Buang ${v}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {d.values.length === 0 && <span className="text-xs text-gray-400">Belum ada nilai</span>}
              </div>
              <div className="flex gap-2">
                <input
                  value={draft[i] ?? ''}
                  onChange={e => setDraft(s => ({ ...s, [i]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addValue(i) } }}
                  placeholder="Nilai (Enter untuk tambah; boleh tampal 'Small, Large, Jumbo')"
                  className={`${inp} flex-1`}
                />
                <button type="button" onClick={() => addValue(i)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold"><Plus className="h-3.5 w-3.5 inline" /> Tambah</button>
              </div>
            </div>
          ))}
          {dims.length < MAX_DIMENSIONS && (
            <button type="button" onClick={addDim} className="text-xs font-semibold text-gray-700 border border-dashed border-gray-300 px-3 py-2 rounded-xl hover:bg-white w-full">
              + Tambah dimensi ({dims.length}/{MAX_DIMENSIONS})
            </button>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Nilai lalai untuk kombinasi BAHARU</p>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block text-xs text-gray-600 mb-1">Harga (RM) *</label><input type="number" step="0.01" min="0" value={defaults.price} onChange={e => setDefaults(s => ({ ...s, price: e.target.value }))} className={`${inp} w-full font-mono`} placeholder="0.00" /></div>
              <div><label className="block text-xs text-gray-600 mb-1">Harga asal (RM)</label><input type="number" step="0.01" min="0" value={defaults.compare_price} onChange={e => setDefaults(s => ({ ...s, compare_price: e.target.value }))} className={`${inp} w-full font-mono`} placeholder="—" /></div>
              <div><label className="block text-xs text-gray-600 mb-1">Stok</label><input type="number" min="0" value={defaults.stock} onChange={e => setDefaults(s => ({ ...s, stock: e.target.value }))} className={`${inp} w-full font-mono`} /></div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Kombinasi yang dah wujud tak disentuh — ubah harga/stok masing-masing di senarai bawah selepas jana.</p>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={generate} disabled={busy || combos === 0} className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Jana {combos} kombinasi
            </button>
            {dims.length === 0 && <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500">Tutup</button>}
          </div>
        </div>
      )}
    </div>
  )
}
