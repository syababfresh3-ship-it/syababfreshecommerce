'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Pagination } from '@/components/admin/pagination'
import { toast } from 'sonner'
import { Search, Star, Scale, EyeOff, Loader2, ScanLine, X, Plus, Pencil, Trash2 } from 'lucide-react'
import { CameraScanner } from '@/components/pos/camera-scanner'

// Tetapan POS per produk/varian — produk kedai TIDAK diubah; semua di pos_product_settings.
// Baris produk: nama POS, jual ikut berat (+ harga/kg), sorok, (tanpa varian: harga POS, barcode, kekunci pantas).
// Baris varian: harga POS, barcode, kekunci pantas + susunan, sorok. Simpan automatik (PATCH) bila berubah.
// Senarai ditapis (carian + kategori) di klien, dipecah 20 produk sepage (?page=N, corak /admin/products).
// Sel barcode: taip / scanner HID, atau butang kamera (CameraScanner sekali-imbas → simpan terus).
// Senarai harga (migration 156): pemilih di atas jadual. "Store prices" = lajur harga edit override global;
// pilih senarai → lajur harga (POS price / RM/kg) edit pos_price_list_items senarai itu, lajur lain kekal global.
// UI dalam Bahasa Inggeris (seluruh seksyen admin POS, keputusan pemilik 9 Nov 2026).

interface Variant { id: string; name: string; price: number; sku: string | null; stock: number | null }
interface Product { id: string; name: string; unit: string | null; price: number; category: string | null; variants: Variant[] }
interface Setting { id?: string; product_id: string; variant_id: string | null; pos_name: string | null; sell_by_weight: boolean; price_per_kg: number | null; pos_price: number | null; barcode: string | null; is_quick_key: boolean; quick_key_order: number; is_hidden: boolean }
interface PriceList { id: string; name: string; is_active: boolean; item_count: number; register_codes: string[] }
interface ListItem { price: number | null; price_per_kg: number | null }

const PAGE_SIZE = 20
const BASE_PATH = '/admin/pos/products'
const ONE_KG = /^\s*1\s*kg\s*$/i
const key = (pid: string, vid: string | null) => `${pid}:${vid ?? ''}`
const blank = (pid: string, vid: string | null): Setting => ({ product_id: pid, variant_id: vid, pos_name: null, sell_by_weight: false, price_per_kg: null, pos_price: null, barcode: null, is_quick_key: false, quick_key_order: 0, is_hidden: false })
const NO_ITEM: ListItem = { price: null, price_per_kg: null }

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error ?? 'Failed')
  return j
}

export function PosProductsClient() {
  const [products, setProducts] = useState<Product[]>([])
  const [settings, setSettings] = useState<Map<string, Setting>>(new Map())
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const router = useRouter()
  const pageParam = Math.max(1, Number(useSearchParams().get('page')) || 1)
  const [loading, setLoading] = useState(true)
  const [migrationOk, setMigrationOk] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Senarai harga
  const [lists, setLists] = useState<PriceList[]>([])
  const [listsOk, setListsOk] = useState(true)
  const [listId, setListId] = useState('')
  const [listItems, setListItems] = useState<Map<string, ListItem>>(new Map())
  const activeList = lists.find(l => l.id === listId) ?? null

  useEffect(() => {
    let alive = true
    fetch('/api/admin/pos/product-settings').then(async res => {
      const j = await res.json().catch(() => ({}))
      if (!alive) return
      if (!res.ok) { toast.error(j.error ?? 'Failed to load'); setLoading(false); return }
      setProducts(j.products ?? [])
      setSettings(new Map(((j.settings ?? []) as Setting[]).map(s => [key(s.product_id, s.variant_id), s])))
      setMigrationOk(j.migrationOk !== false)
      setLoading(false)
    }).catch(() => { if (alive) { toast.error('Failed to load'); setLoading(false) } })
    fetch('/api/admin/pos/price-lists').then(async res => {
      const j = await res.json().catch(() => ({}))
      if (!alive) return
      setLists(j.lists ?? []); setListsOk(j.migrationOk !== false && res.status !== 503)
    }).catch(() => { if (alive) setListsOk(false) })
    return () => { alive = false }
  }, [])

  // Item senarai bila senarai dipilih (kosongkan dilakukan dalam onChange pemilih, bukan di sini)
  useEffect(() => {
    if (!listId) return
    let alive = true
    fetch(`/api/admin/pos/price-lists/items?list=${listId}`).then(r => r.json()).then(j => {
      if (!alive) return
      setListItems(new Map(((j.items ?? []) as { product_id: string; variant_id: string | null; price: number | null; price_per_kg: number | null }[]).map(i => [key(i.product_id, i.variant_id), { price: i.price == null ? null : Number(i.price), price_per_kg: i.price_per_kg == null ? null : Number(i.price_per_kg) }])))
    }).catch(() => toast.error('Failed to load price list items'))
    return () => { alive = false }
  }, [listId])

  const get = (pid: string, vid: string | null) => settings.get(key(pid, vid)) ?? blank(pid, vid)
  const save = async (pid: string, vid: string | null, patch: Partial<Setting>) => {
    const k = key(pid, vid)
    const prev = get(pid, vid)
    setSettings(m => new Map(m).set(k, { ...prev, ...patch }))
    setSaving(k)
    try {
      const res = await fetch('/api/admin/pos/product-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: pid, variant_id: vid, patch }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error ?? 'Failed to save'); setSettings(m => new Map(m).set(k, prev)); return }
      setSettings(m => new Map(m).set(k, j.setting))
    } finally { setSaving(null) }
  }

  const listGet = (pid: string, vid: string | null) => listItems.get(key(pid, vid)) ?? NO_ITEM
  const listSave = async (pid: string, vid: string | null, patch: Partial<ListItem>) => {
    if (!listId) return
    const k = key(pid, vid)
    const prev = listGet(pid, vid)
    setListItems(m => new Map(m).set(k, { ...prev, ...patch }))
    setSaving(k)
    try {
      const j = await api('/api/admin/pos/price-lists/items', { method: 'PATCH', body: JSON.stringify({ price_list_id: listId, product_id: pid, variant_id: vid, ...patch }) })
      setListItems(m => { const n = new Map(m); if (j.item) n.set(k, { price: j.item.price == null ? null : Number(j.item.price), price_per_kg: j.item.price_per_kg == null ? null : Number(j.item.price_per_kg) }); else n.delete(k); return n })
      setLists(ls => ls.map(l => l.id === listId ? { ...l, item_count: Math.max(0, l.item_count + (j.item && prev === NO_ITEM ? 1 : !j.item && prev !== NO_ITEM ? -1 : 0)) } : l))
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to save'); setListItems(m => new Map(m).set(k, prev)) } finally { setSaving(null) }
  }

  const newList = async () => {
    const name = prompt('Price list name (e.g. Bazar Ramadan):')?.trim()
    if (!name) return
    try { const j = await api('/api/admin/pos/price-lists', { method: 'POST', body: JSON.stringify({ name }) }); setLists(ls => [...ls, j.list]); setListItems(new Map()); setListId(j.list.id); toast.success('Price list created — assign it to a register in Cashiers & Access') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }
  const renameList = async () => {
    if (!activeList) return
    const name = prompt('New name:', activeList.name)?.trim()
    if (!name || name === activeList.name) return
    try { const j = await api('/api/admin/pos/price-lists', { method: 'PATCH', body: JSON.stringify({ id: activeList.id, name }) }); setLists(ls => ls.map(l => l.id === activeList.id ? { ...l, ...j.list } : l)); toast.success('Renamed') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }
  const deleteList = async () => {
    if (!activeList) return
    const used = activeList.register_codes.length ? ` Registers ${activeList.register_codes.join(', ')} will fall back to store prices.` : ''
    if (!confirm(`Delete price list "${activeList.name}" and its ${activeList.item_count} prices?${used}`)) return
    try { await api(`/api/admin/pos/price-lists?id=${activeList.id}`, { method: 'DELETE' }); setLists(ls => ls.filter(l => l.id !== activeList.id)); setListItems(new Map()); setListId(''); toast.success('Price list deleted') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category ?? '').filter(Boolean))).sort((a, b) => a.localeCompare(b)), [products])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return products.filter(p =>
      (!cat || (p.category ?? '') === cat) &&
      (!s || p.name.toLowerCase().includes(s) || p.variants.some(v => v.name.toLowerCase().includes(s) || v.sku?.toLowerCase().includes(s))))
  }, [products, q, cat])
  // Page dari URL; dikekang ke page terakhir bila tapisan mengecilkan senarai (tanpa setState dalam effect)
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const page = Math.min(pageParam, totalPages)
  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // Tukar carian / kategori → kembali ke page 1
  const resetPage = () => { if (pageParam > 1) router.replace(BASE_PATH) }
  const mode: 'store' | 'list' = listId ? 'list' : 'store'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">POS Products</h1><p className="text-sm text-gray-500">Favourites, sell by weight (added option — original packs stay), barcodes &amp; POS prices. Store products are not changed. Open weight for ALL products with a 1kg variant: POS Settings → Open weight.</p></div>
        <div className="flex items-center gap-2">
          <select value={cat} onChange={e => { setCat(e.target.value); resetPage() }} aria-label="Category" className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input value={q} onChange={e => { setQ(e.target.value); resetPage() }} placeholder="Search product / variant / SKU" className="h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm w-72" /></div>
        </div>
      </div>
      {!migrationOk && <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">Migration 155 (POS) has not been run — settings cannot be saved.</div>}

      {/* Senarai harga */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Prices for</span>
          <select value={listId} onChange={e => { setListItems(new Map()); setListId(e.target.value) }} aria-label="Price list" className="h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white" disabled={!listsOk}>
            <option value="">Store prices (default)</option>
            {lists.map(l => <option key={l.id} value={l.id}>{l.name}{!l.is_active ? ' (inactive)' : ''}</option>)}
          </select>
          <button type="button" onClick={newList} disabled={!listsOk} className="h-9 px-3 rounded-lg border border-gray-300 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> New price list</button>
          {activeList && <>
            <button type="button" onClick={renameList} className="h-9 px-3 rounded-lg border border-gray-300 text-xs font-semibold inline-flex items-center gap-1"><Pencil className="h-3.5 w-3.5" /> Rename</button>
            <button type="button" onClick={deleteList} className="h-9 px-3 rounded-lg border border-gray-300 text-xs font-semibold inline-flex items-center gap-1 text-red-700"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </>}
        </div>
        {!listsOk && <p className="text-xs text-amber-800">Migration 156 (price lists) has not been run — per-outlet prices are unavailable until then.</p>}
        {activeList
          ? <p className="text-xs text-gray-500">Editing <span className="font-semibold text-gray-800">{activeList.name}</span> prices ({activeList.item_count} set). Empty = falls back to the store price / global POS price. Used by registers: {activeList.register_codes.length ? <span className="font-semibold text-gray-800">{activeList.register_codes.join(', ')}</span> : <>none yet — assign it in Cashiers &amp; Access → register Edit</>}. Name, barcode, favourite and hide are global and still editable here.</p>
          : <p className="text-xs text-gray-500">Store prices apply to every register without a price list. Create a list (e.g. Bazar) to charge different prices at an outlet.</p>}
      </div>

      {loading ? <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <tr><th className="px-3 py-2">Product / variant</th><th className="px-3 py-2">Store price</th><th className="px-3 py-2">POS name</th><th className="px-3 py-2">{mode === 'list' ? `${activeList?.name} price` : 'Weight / price'}</th><th className="px-3 py-2">Barcode</th><th className="px-3 py-2">Favourite</th><th className="px-3 py-2">Hide</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItems.map(p => {
                const ps = get(p.id, null)
                const noVariants = p.variants.length === 0
                return (
                  <ProductRows key={p.id} p={p} ps={ps} noVariants={noVariants} get={get} save={save} saving={saving} mode={mode} listGet={listGet} listSave={listSave} />
                )
              })}
              {pageItems.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-400">No matching products.</td></tr>}
            </tbody>
          </table>
          <Pagination page={page} total={list.length} pageSize={PAGE_SIZE} basePath={BASE_PATH} />
        </div>
      )}
    </div>
  )
}

function ProductRows({ p, ps, noVariants, get, save, saving, mode, listGet, listSave }: {
  p: Product; ps: Setting; noVariants: boolean
  get: (pid: string, vid: string | null) => Setting
  save: (pid: string, vid: string | null, patch: Partial<Setting>) => Promise<void>
  saving: string | null
  mode: 'store' | 'list'
  listGet: (pid: string, vid: string | null) => ListItem
  listSave: (pid: string, vid: string | null, patch: Partial<ListItem>) => Promise<void>
}) {
  const v1 = p.variants.find(v => ONE_KG.test(v.name))
  const li = listGet(p.id, null)
  // Harga/kg lalai (ditunjuk sebagai placeholder dalam mod senarai): tetapan produk → varian 1kg
  const perKgDefault = ps.price_per_kg ?? v1?.price ?? null
  return (
    <>
      <tr className="bg-gray-50/60">
        <td className="px-3 py-2 font-semibold text-gray-900">{p.name}<span className="block text-xs font-normal text-gray-400">{p.category ?? '—'}{saving === key(p.id, null) ? ' · saving…' : ''}</span></td>
        <td className="px-3 py-2 tabular-nums text-gray-600">RM{p.price.toFixed(2)}{p.unit ? `/${p.unit}` : ''}</td>
        <td className="px-3 py-2"><TextCell value={ps.pos_name ?? ''} placeholder={p.name} onCommit={v => save(p.id, null, { pos_name: v || null })} /></td>
        <td className="px-3 py-2">
          {mode === 'store' ? (
            <>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium"><input type="checkbox" checked={ps.sell_by_weight} onChange={e => save(p.id, null, { sell_by_weight: e.target.checked })} /><Scale className="h-3.5 w-3.5" /> by kg</label>
              {ps.sell_by_weight && <div className="mt-1 flex items-center gap-1 text-xs">RM/kg <NumCell value={ps.price_per_kg} placeholder={v1 ? `auto ${v1.price}` : 'required'} onCommit={v => save(p.id, null, { price_per_kg: v })} /></div>}
              {noVariants && <div className="mt-1 flex items-center gap-1 text-xs">POS price <NumCell value={ps.pos_price} placeholder={String(p.price)} onCommit={v => save(p.id, null, { pos_price: v })} /></div>}
            </>
          ) : (
            <>
              {(ps.sell_by_weight || v1) && <div className="flex items-center gap-1 text-xs">RM/kg <NumCell value={li.price_per_kg} placeholder={perKgDefault != null ? `default ${perKgDefault}` : 'n/a'} onCommit={v => listSave(p.id, null, { price_per_kg: v })} /></div>}
              {noVariants && <div className="mt-1 flex items-center gap-1 text-xs">Price <NumCell value={li.price} placeholder={`default ${ps.pos_price ?? p.price}`} onCommit={v => listSave(p.id, null, { price: v })} /></div>}
              {!noVariants && !ps.sell_by_weight && !v1 && <span className="text-xs text-gray-300">—</span>}
            </>
          )}
        </td>
        <td className="px-3 py-2">{noVariants || ps.sell_by_weight ? <BarcodeCell value={ps.barcode ?? ''} onCommit={v => save(p.id, null, { barcode: v || null })} /> : <span className="text-xs text-gray-300">—</span>}</td>
        <td className="px-3 py-2">{(noVariants || ps.sell_by_weight) && <QuickCell s={ps} onChange={patch => save(p.id, null, patch)} />}</td>
        <td className="px-3 py-2"><label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={ps.is_hidden} onChange={e => save(p.id, null, { is_hidden: e.target.checked })} /><EyeOff className="h-3.5 w-3.5" /></label></td>
      </tr>
      {p.variants.map(v => {
        const vs = get(p.id, v.id)
        const vl = listGet(p.id, v.id)
        return (
          <tr key={v.id}>
            <td className="px-3 py-2 pl-7 text-gray-700">↳ {v.name}<span className="block text-xs text-gray-400">{v.sku ? `SKU ${v.sku} · ` : ''}stock {v.stock ?? '—'}{saving === key(p.id, v.id) ? ' · saving…' : ''}</span></td>
            <td className="px-3 py-2 tabular-nums text-gray-600">RM{v.price.toFixed(2)}</td>
            <td className="px-3 py-2"><TextCell value={vs.pos_name ?? ''} placeholder={ps.pos_name ?? p.name} onCommit={val => save(p.id, v.id, { pos_name: val || null })} /></td>
            <td className="px-3 py-2">
              {mode === 'store'
                ? <div className="flex items-center gap-1 text-xs">POS price <NumCell value={vs.pos_price} placeholder={String(v.price)} onCommit={val => save(p.id, v.id, { pos_price: val })} /></div>
                : <div className="flex items-center gap-1 text-xs">Price <NumCell value={vl.price} placeholder={`default ${vs.pos_price ?? v.price}`} onCommit={val => listSave(p.id, v.id, { price: val })} /></div>}
            </td>
            <td className="px-3 py-2"><BarcodeCell value={vs.barcode ?? ''} onCommit={val => save(p.id, v.id, { barcode: val || null })} /></td>
            <td className="px-3 py-2"><QuickCell s={vs} onChange={patch => save(p.id, v.id, patch)} /></td>
            <td className="px-3 py-2"><label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={vs.is_hidden} onChange={e => save(p.id, v.id, { is_hidden: e.target.checked })} /><EyeOff className="h-3.5 w-3.5" /></label></td>
          </tr>
        )
      })}
    </>
  )
}

function TextCell({ value, placeholder, onCommit, mono }: { value: string; placeholder?: string; onCommit: (v: string) => void; mono?: boolean }) {
  const [v, setV] = useState(value)
  const [prev, setPrev] = useState(value)
  if (prev !== value) { setPrev(value); setV(value) }
  return <input value={v} onChange={e => setV(e.target.value)} onBlur={() => v !== value && onCommit(v.trim())} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder={placeholder} className={`h-8 px-2 rounded-md border border-gray-200 text-sm w-36 ${mono ? 'font-mono' : ''}`} />
}
/** Barcode: input teks + butang kamera (modal ringkas; admin tiada komponen Dialog). Kod pertama → simpan & tutup. */
function BarcodeCell({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex items-center gap-1">
      <TextCell value={value} placeholder="barcode" onCommit={onCommit} mono />
      <button type="button" onClick={() => setOpen(true)} aria-label="Scan with camera" title="Scan with camera" className="h-8 w-8 shrink-0 grid place-items-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"><ScanLine className="h-4 w-4" /></button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Scan barcode">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 mx-auto max-w-md rounded-2xl bg-white p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-900">Scan barcode</h3><button type="button" onClick={() => setOpen(false)} aria-label="Close" className="h-8 w-8 grid place-items-center rounded-md hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
            <CameraScanner continuous={false} onScan={code => { onCommit(code.trim()); setOpen(false) }} />
          </div>
        </div>
      )}
    </div>
  )
}
function NumCell({ value, placeholder, onCommit }: { value: number | null; placeholder?: string; onCommit: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? '' : String(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) { setPrev(value); setV(value == null ? '' : String(value)) }
  return <input value={v} onChange={e => setV(e.target.value)} inputMode="decimal" onBlur={() => { const n = v.trim() === '' ? null : Number(v); if (n !== value && (n === null || Number.isFinite(n))) onCommit(n) }} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder={placeholder} className="h-8 px-2 rounded-md border border-gray-200 text-sm w-28 tabular-nums" />
}
function QuickCell({ s, onChange }: { s: Setting; onChange: (patch: Partial<Setting>) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange({ is_quick_key: !s.is_quick_key })} aria-label="Favourite" className={`h-8 w-8 grid place-items-center rounded-md border ${s.is_quick_key ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-400'}`}><Star className="h-4 w-4" /></button>
      {s.is_quick_key && <NumCell value={s.quick_key_order} placeholder="order" onCommit={v => onChange({ quick_key_order: v ?? 0 })} />}
    </div>
  )
}
