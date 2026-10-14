'use client'

// Gift Studio catalog manager — Boxes, Fillings, Designs (migration 137).
// Each combination stays one catalog row; the customer configurator (/kurma/reka)
// reads the active ones. See lib/gift.ts.
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Box, Package, ImageIcon, UploadCloud, Save } from 'lucide-react'
import { WEIGHTS } from '@/lib/gift'
import { DEFAULT_LOGO_AREA, isValidLogoArea, normalizeLogoArea, logoAreaStyle, type LogoArea } from '@/lib/gift-mockup'

type Kind = 'box' | 'filling' | 'design'
interface Row { id?: string; [k: string]: unknown }
interface Catalog { boxes: Row[]; fillings: Row[]; designs: Row[] }

const inp = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500'
const lbl = 'block text-[11px] font-semibold text-gray-500 mb-1'

// tiers jsonb ↔ "50:12, 100:10" (min_qty:unit_price)
function tiersToText(t: unknown): string {
  if (!Array.isArray(t)) return ''
  return t.map((x: { min_qty?: number; unit_price?: number }) => `${x.min_qty}:${x.unit_price}`).join(', ')
}
function textToTiers(s: string): { min_qty: number; unit_price: number }[] | null {
  const parts = s.split(',').map(x => x.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const out: { min_qty: number; unit_price: number }[] = []
  for (const p of parts) {
    const [q, pr] = p.split(':').map(x => Number(x.trim()))
    if (Number.isFinite(q) && Number.isFinite(pr)) out.push({ min_qty: q, unit_price: pr })
  }
  return out.length ? out.sort((a, b) => a.min_qty - b.min_qty) : null
}

export function CatalogClient() {
  const [tab, setTab] = useState<Kind>('box')
  const [cat, setCat] = useState<Catalog>({ boxes: [], fillings: [], designs: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/kurma/catalog')
    const j = await res.json().catch(() => ({}))
    setCat({ boxes: j.boxes ?? [], fillings: j.fillings ?? [], designs: j.designs ?? [] })
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function save(kind: Kind, row: Row) {
    setBusy(row.id ?? 'new')
    try {
      const method = row.id ? 'PATCH' : 'POST'
      const res = await fetch('/api/admin/kurma/catalog', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: kind, ...row }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Save failed'); return }
      toast.success('Saved'); await load()
    } finally { setBusy(null) }
  }
  async function remove(kind: Kind, id: string) {
    if (!window.confirm('Delete this item?')) return
    const res = await fetch(`/api/admin/kurma/catalog?type=${kind}&id=${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Delete failed'); return }
    toast.success('Deleted'); await load()
  }

  const tabs: { id: Kind; label: string; icon: React.ElementType; n: number }[] = [
    { id: 'box', label: 'Boxes', icon: Box, n: cat.boxes.length },
    { id: 'filling', label: 'Fillings', icon: Package, n: cat.fillings.length },
    { id: 'design', label: 'Designs', icon: ImageIcon, n: cat.designs.length },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Gift Studio — Catalog</h1>
        <p className="text-sm text-gray-500 mt-0.5">Boxes, fillings and preset designs shown in the customer configurator at <code className="bg-gray-100 px-1 rounded">/kurma</code>.</p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
            <t.icon className="h-4 w-4" />{t.label}<span className="text-gray-400">{t.n}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : tab === 'box' ? (
        <BoxList rows={cat.boxes} busy={busy} onSave={r => save('box', r)} onDelete={id => remove('box', id)} />
      ) : tab === 'filling' ? (
        <FillingList rows={cat.fillings} busy={busy} onSave={r => save('filling', r)} onDelete={id => remove('filling', id)} />
      ) : (
        <DesignList rows={cat.designs} boxes={cat.boxes} busy={busy} onSave={r => save('design', r)} onDelete={id => remove('design', id)} />
      )}
    </div>
  )
}

// ── Upload helper (image or .glb) ──────────────────────────────────────────────
function UploadButton({ label, accept, onDone }: { label: string; accept: string; onDone: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [up, setUp] = useState(false)
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setUp(true)
    try {
      const fd = new FormData(); fd.append('file', f)
      const res = await fetch('/api/admin/kurma/upload', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Upload failed'); return }
      onDone(j.url); toast.success('Uploaded')
    } finally { setUp(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <button type="button" onClick={() => ref.current?.click()} disabled={up} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
      {up ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}{label}
      <input ref={ref} type="file" accept={accept} onChange={pick} className="hidden" />
    </button>
  )
}

function Thumb({ url }: { url: unknown }) {
  const u = typeof url === 'string' ? url : ''
  return u
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={u} alt="" className="h-14 w-14 rounded-lg object-cover border border-gray-200 shrink-0" />
    : <div className="h-14 w-14 rounded-lg bg-gray-100 border border-gray-200 grid place-items-center text-gray-300 shrink-0"><ImageIcon className="h-5 w-5" /></div>
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-gray-200 rounded-xl p-3">{children}</div>
}

// ── Boxes ──────────────────────────────────────────────────────────────────────
function BoxList({ rows, busy, onSave, onDelete }: { rows: Row[]; busy: string | null; onSave: (r: Row) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState<Record<string, Row>>({})
  const val = (r: Row, k: string) => (draft[r.id ?? 'new']?.[k] ?? r[k] ?? '') as string
  const set = (r: Row, k: string, v: unknown) => setDraft(d => ({ ...d, [r.id ?? 'new']: { ...(d[r.id ?? 'new'] ?? { id: r.id }), [k]: v } }))
  const blank: Row = { name: '', base_price: '', capacity_label: '', image_url: '', model_url: '', tiers: '', is_active: true, sort_order: rows.length }
  const items = [...rows, blank]
  return (
    <div className="space-y-2.5">
      {items.map((r, i) => {
        const isNew = !r.id
        const key = r.id ?? 'new'
        const merged = { ...r, ...(draft[key] ?? {}) }
        const tiersVal = draft[key]?.tiers !== undefined ? (draft[key]!.tiers as string) : tiersToText(r.tiers)
        return (
          <Card key={key + i}>
            <div className="flex items-start gap-3">
              <Thumb url={merged.image_url} />
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="md:col-span-2"><label className={lbl}>Box name</label><input className={inp} value={val(r, 'name')} onChange={e => set(r, 'name', e.target.value)} placeholder="e.g. Premium Rigid Box" /></div>
                <div><label className={lbl}>Base price (RM)</label><input type="number" step="0.01" className={`${inp} font-mono`} value={val(r, 'base_price')} onChange={e => set(r, 'base_price', e.target.value)} /></div>
                <div><label className={lbl}>Capacity note</label><input className={inp} value={val(r, 'capacity_label')} onChange={e => set(r, 'capacity_label', e.target.value)} placeholder="fits 6–12 pcs" /></div>
                <div className="md:col-span-4"><label className={lbl}>Bulk tiers — min_qty:unit_price (comma-separated)</label><input className={`${inp} font-mono`} value={tiersVal} onChange={e => set(r, 'tiers', e.target.value)} placeholder="50:18, 100:16, 300:14" /></div>
                <div className="md:col-span-4">
                  <label className={lbl}>Supported weights <span className="font-normal text-gray-400">(none ticked = all)</span></label>
                  <div className="flex gap-3">
                    {WEIGHTS.map(w => {
                      const cur: string[] = Array.isArray(merged.weights) ? merged.weights as string[] : []
                      const on = cur.includes(w.code)
                      return (
                        <label key={w.code} className="flex items-center gap-1.5 text-sm text-gray-700">
                          <input type="checkbox" checked={on} onChange={e => set(r, 'weights', e.target.checked ? [...cur, w.code] : cur.filter(x => x !== w.code))} />{w.label}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
              <UploadButton label="Image" accept="image/*" onDone={u => set(r, 'image_url', u)} />
              <UploadButton label="3D model (.glb)" accept=".glb,model/gltf-binary" onDone={u => set(r, 'model_url', u)} />
              {typeof merged.model_url === 'string' && merged.model_url && <span className="text-[11px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full">3D ready</span>}
              <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-1"><input type="checkbox" checked={merged.is_active !== false} onChange={e => set(r, 'is_active', e.target.checked)} />Active</label>
              <div className="ml-auto flex items-center gap-2">
                {!isNew && <button onClick={() => onDelete(r.id as string)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
                <button onClick={() => onSave({ ...merged, base_price: Number(merged.base_price) || 0, tiers: textToTiers(String(tiersVal ?? '')), sort_order: Number(merged.sort_order) || i })} disabled={busy === key} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isNew ? <Plus className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}{isNew ? 'Add box' : 'Save'}
                </button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── Fillings ─────────────────────────────────────────────────────────────────────
function FillingList({ rows, busy, onSave, onDelete }: { rows: Row[]; busy: string | null; onSave: (r: Row) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState<Record<string, Row>>({})
  const val = (r: Row, k: string) => (draft[r.id ?? 'new']?.[k] ?? r[k] ?? '') as string
  const set = (r: Row, k: string, v: unknown) => setDraft(d => ({ ...d, [r.id ?? 'new']: { ...(d[r.id ?? 'new'] ?? { id: r.id }), [k]: v } }))
  const blank: Row = { name: '', price: '', unit: 'pcs', grade: '', image_url: '', is_active: true, sort_order: rows.length }
  const items = [...rows, blank]
  return (
    <div className="space-y-2.5">
      {items.map((r, i) => {
        const isNew = !r.id; const key = r.id ?? 'new'; const merged = { ...r, ...(draft[key] ?? {}) }
        return (
          <Card key={key + i}>
            <div className="flex items-start gap-3">
              <Thumb url={merged.image_url} />
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="md:col-span-2"><label className={lbl}>Filling name</label><input className={inp} value={val(r, 'name')} onChange={e => set(r, 'name', e.target.value)} placeholder="e.g. Kurma Ajwa" /></div>
                <div><label className={lbl}>Price (RM)</label><input type="number" step="0.01" className={`${inp} font-mono`} value={val(r, 'price')} onChange={e => set(r, 'price', e.target.value)} /></div>
                <div><label className={lbl}>Unit</label>
                  <select className={inp} value={String(merged.unit ?? 'pcs')} onChange={e => set(r, 'unit', e.target.value)}>
                    <option value="pcs">per pcs</option><option value="gram">per gram</option><option value="box">per box</option>
                  </select>
                </div>
                <div><label className={lbl}>Grade (optional)</label><input className={inp} value={val(r, 'grade')} onChange={e => set(r, 'grade', e.target.value)} /></div>
                <div className="md:col-span-4">
                  <label className={lbl}>Price by weight <span className="font-normal text-gray-400">(overrides base price; blank = use base)</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {WEIGHTS.map(w => {
                      const prices = (merged.prices ?? {}) as Record<string, number>
                      return (
                        <div key={w.code} className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500 w-10">{w.label}</span>
                          <input type="number" step="0.01" className={`${inp} font-mono`} value={prices[w.code] ?? ''} placeholder="—"
                            onChange={e => { const v = e.target.value; const next = { ...prices }; if (v === '') delete next[w.code]; else next[w.code] = Number(v); set(r, 'prices', next) }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
              <UploadButton label="Image" accept="image/*" onDone={u => set(r, 'image_url', u)} />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-1"><input type="checkbox" checked={merged.is_active !== false} onChange={e => set(r, 'is_active', e.target.checked)} />Active</label>
              <div className="ml-auto flex items-center gap-2">
                {!isNew && <button onClick={() => onDelete(r.id as string)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
                <button onClick={() => onSave({ ...merged, price: Number(merged.price) || 0, sort_order: Number(merged.sort_order) || i })} disabled={busy === key} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isNew ? <Plus className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}{isNew ? 'Add filling' : 'Save'}
                </button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── Designs ──────────────────────────────────────────────────────────────────────
function DesignList({ rows, boxes, busy, onSave, onDelete }: { rows: Row[]; boxes: Row[]; busy: string | null; onSave: (r: Row) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState<Record<string, Row>>({})
  const val = (r: Row, k: string) => (draft[r.id ?? 'new']?.[k] ?? r[k] ?? '') as string
  const set = (r: Row, k: string, v: unknown) => setDraft(d => ({ ...d, [r.id ?? 'new']: { ...(d[r.id ?? 'new'] ?? { id: r.id }), [k]: v } }))
  const blank: Row = { name: '', box_id: '', price_add: '', image_url: '', is_active: true, sort_order: rows.length }
  const items = [...rows, blank]
  return (
    <div className="space-y-2.5">
      {items.map((r, i) => {
        const isNew = !r.id; const key = r.id ?? 'new'; const merged = { ...r, ...(draft[key] ?? {}) }
        return (
          <Card key={key + i}>
            <div className="flex items-start gap-3">
              <Thumb url={merged.image_url} />
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="md:col-span-2"><label className={lbl}>Design name</label><input className={inp} value={val(r, 'name')} onChange={e => set(r, 'name', e.target.value)} placeholder="e.g. Ramadan Gold" /></div>
                <div><label className={lbl}>For box</label>
                  <select className={inp} value={String(merged.box_id ?? '')} onChange={e => set(r, 'box_id', e.target.value || null)}>
                    <option value="">Any box (universal)</option>
                    {boxes.map(b => <option key={b.id as string} value={b.id as string}>{b.name as string}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Design fee (RM)</label><input type="number" step="0.01" className={`${inp} font-mono`} value={val(r, 'price_add')} onChange={e => set(r, 'price_add', e.target.value)} placeholder="0" /></div>
                {/* Kawasan logo (migration 143) — pecahan 0..1 imej; preview langsung = sama dgn studio */}
                <div className="md:col-span-4">
                  <label className={lbl}>Logo area <span className="font-normal text-gray-400">(x, y, w, h — pecahan 0–1 dari imej; kosong = default tengah 40%×30%)</span></label>
                  {(() => {
                    const la = isValidLogoArea(merged.logo_area) ? merged.logo_area as LogoArea : null
                    const setLa = (k: keyof LogoArea, v: string) => set(r, 'logo_area', { ...(la ?? DEFAULT_LOGO_AREA), [k]: Number(v) })
                    return (
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="grid grid-cols-4 gap-2">
                          {(['x', 'y', 'w', 'h'] as const).map(k => (
                            <div key={k}><span className="block text-[10px] text-gray-400 uppercase">{k}</span><input type="number" step="0.01" min="0" max="1" aria-label={`Logo area ${k}`} className={`${inp} font-mono w-20`} value={la ? la[k] : ''} placeholder={String(DEFAULT_LOGO_AREA[k])} onChange={e => setLa(k, e.target.value)} /></div>
                          ))}
                        </div>
                        <button type="button" onClick={() => set(r, 'logo_area', null)} className="text-[11px] font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50">Default</button>
                        {typeof merged.image_url === 'string' && merged.image_url && (
                          <div className="relative w-44 rounded-lg overflow-hidden border border-gray-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={merged.image_url} alt="" className="block w-full h-auto" />
                            <div className="absolute border-2 border-dashed border-red-500/80 bg-red-500/10 grid place-items-center text-[9px] font-bold text-red-700" style={logoAreaStyle(normalizeLogoArea(merged.logo_area))}>LOGO</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
              <UploadButton label="Image" accept="image/*" onDone={u => set(r, 'image_url', u)} />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-1"><input type="checkbox" checked={merged.is_active !== false} onChange={e => set(r, 'is_active', e.target.checked)} />Active</label>
              <div className="ml-auto flex items-center gap-2">
                {!isNew && <button onClick={() => onDelete(r.id as string)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
                <button onClick={() => onSave({ ...merged, price_add: Number(merged.price_add) || 0, box_id: merged.box_id || null, sort_order: Number(merged.sort_order) || i, logo_area: isValidLogoArea(merged.logo_area) ? merged.logo_area : null })} disabled={busy === key} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isNew ? <Plus className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}{isNew ? 'Add design' : 'Save'}
                </button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
