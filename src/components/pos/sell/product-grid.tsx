'use client'

import { useEffect, useMemo, useRef } from 'react'
import { LayoutGrid, Scale, Star, ChevronRight } from 'lucide-react'
import { searchItems } from '@/lib/search'
import { rm } from '@/lib/pos/money'
import type { PosCatalog, PosCatalogItem } from '@/lib/pos/types'

// Grid produk POS — tab kategori (Kegemaran · Kategori · Semua · kategori…) + jubin besar.
// • Tab "Kategori" = paparan SEMUA kategori sebagai jubin DALAM kawasan grid (bukan popup).
// • Dalam kategori / Semua: SATU jubin = SATU produk (variety) dengan julat harga & bilangan saiz;
//   ketuk → sheet pilih saiz (gram). Produk satu saiz terus masuk tiket.
// • Kegemaran & carian: jubin peringkat varian (satu ketukan; imbas barcode perlu varian tepat).
// Habis stok dipudarkan tetapi TIDAK disekat (barang ada di tangan pelanggan; angka stok kedai mungkin lapuk).

export const CAT_QUICK = 'quick'
export const CAT_ALL = 'all'
export const CAT_BROWSE = 'categories'

export interface PosProductGroup {
  productId: string
  name: string
  categoryId: string | null
  items: PosCatalogItem[]
  minPrice: number
  maxPrice: number
  hasKg: boolean
  stockZero: boolean
}

export function CategoryChips({ catalog, value, onChange }: { catalog: PosCatalog; value: string; onChange: (v: string) => void }) {
  const hasQuick = catalog.items.some(i => i.isQuickKey)
  const chips = [{ id: CAT_ALL, name: 'All' }, ...catalog.categories.map(c => ({ id: c.id, name: c.name }))]
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }) }, [value])
  const cls = (active: boolean) => `shrink-0 inline-flex items-center gap-1 h-10 px-3.5 rounded-full text-[13px] font-bold border ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
      {hasQuick && (
        <button type="button" onClick={() => onChange(CAT_QUICK)} ref={value === CAT_QUICK ? activeRef : undefined} className={cls(value === CAT_QUICK)}>
          <Star className="h-3.5 w-3.5" />Favourites
        </button>
      )}
      <button type="button" onClick={() => onChange(CAT_BROWSE)} ref={value === CAT_BROWSE ? activeRef : undefined} className={cls(value === CAT_BROWSE)}>
        <LayoutGrid className="h-3.5 w-3.5" />Categories
      </button>
      {chips.map(c => (
        <button key={c.id} type="button" onClick={() => onChange(c.id)} ref={value === c.id ? activeRef : undefined} className={cls(value === c.id)}>{c.name}</button>
      ))}
    </div>
  )
}

/** Paparan tab Kategori — jubin semua kategori + bilangan produk dalam kawasan grid; ketuk → tab kategori itu. */
export function CategoryGrid({ catalog, value, onPick }: { catalog: PosCatalog; value: string; onPick: (v: string) => void }) {
  const counts = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const it of catalog.items) if (it.categoryId) { if (!m.has(it.categoryId)) m.set(it.categoryId, new Set()); m.get(it.categoryId)!.add(it.productId) }
    return m
  }, [catalog])
  const quick = catalog.items.filter(i => i.isQuickKey).length
  const totalProducts = new Set(catalog.items.map(i => i.productId)).size
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
      {quick > 0 && <CatTile id={CAT_QUICK} name="Favourites" count={quick} unit="items" icon={<Star className="h-3.5 w-3.5" />} active={value === CAT_QUICK} onPick={onPick} />}
      <CatTile id={CAT_ALL} name="All" count={totalProducts} unit="products" active={value === CAT_ALL} onPick={onPick} />
      {catalog.categories.map(c => <CatTile key={c.id} id={c.id} name={c.name} count={counts.get(c.id)?.size ?? 0} unit="products" active={value === c.id} onPick={onPick} />)}
    </div>
  )
}

function CatTile({ id, name, count, unit, icon, active, onPick }: { id: string; name: string; count: number; unit: string; icon?: React.ReactNode; active: boolean; onPick: (v: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(id)}
      className={`min-h-[96px] rounded-2xl border p-4 text-left ${active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-900 active:bg-gray-100'}`}>
      <p className="text-[17px] font-extrabold leading-tight inline-flex items-center gap-1.5">{icon}{name}</p>
      <p className={`text-[12px] font-semibold mt-1 ${active ? 'text-white/70' : 'text-gray-500'}`}>{count} {unit}</p>
    </button>
  )
}

export function filterCatalog(catalog: PosCatalog, query: string, categoryId: string): PosCatalogItem[] {
  const q = query.trim()
  if (q) {
    const exact = catalog.items.filter(i => i.barcode === q || (i.sku && i.sku.toLowerCase() === q.toLowerCase()))
    if (exact.length > 0) return exact
    return searchItems(catalog.items, q, i => ({ name: `${i.name} ${i.variantName ?? ''} ${i.sku ?? ''}`, category: i.categoryName }))
  }
  if (categoryId === CAT_QUICK) return catalog.items.filter(i => i.isQuickKey).sort((a, b) => a.quickKeyOrder - b.quickKeyOrder || a.name.localeCompare(b.name))
  if (categoryId === CAT_ALL) return catalog.items
  return catalog.items.filter(i => i.categoryId === categoryId)
}

/** Kumpulkan item varian ikut produk — susunan ikut kemunculan pertama (sort_order kedai). */
export function groupByProduct(items: PosCatalogItem[]): PosProductGroup[] {
  const map = new Map<string, PosProductGroup>()
  for (const it of items) {
    const g = map.get(it.productId)
    if (g) {
      g.items.push(it); g.minPrice = Math.min(g.minPrice, it.price); g.maxPrice = Math.max(g.maxPrice, it.price)
      g.hasKg = g.hasKg || it.unit === 'kg'; g.stockZero = g.stockZero && it.stock === 0
    } else {
      map.set(it.productId, { productId: it.productId, name: it.name, categoryId: it.categoryId, items: [it], minPrice: it.price, maxPrice: it.price, hasKg: it.unit === 'kg', stockZero: it.stock === 0 })
    }
  }
  return Array.from(map.values())
}

function ItemTile({ it, onPick }: { it: PosCatalogItem; onPick: (item: PosCatalogItem) => void }) {
  const out = it.stock === 0
  return (
    <button type="button" onClick={() => onPick(it)}
      className={`relative text-left min-h-[116px] p-4 rounded-2xl bg-white border border-gray-200 active:bg-gray-100 active:scale-[0.98] transition ${out ? 'opacity-60' : ''}`}>
      {it.unit === 'kg' && <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 h-5 rounded-full bg-gray-900 text-white"><Scale className="h-3 w-3" />kg</span>}
      <p className="text-[15px] font-extrabold text-gray-900 leading-tight line-clamp-2 pr-6">{it.name}</p>
      {it.variantName && it.unit !== 'kg' && <p className="text-[12px] font-semibold text-gray-500 mt-1 truncate">{it.variantName}</p>}
      <p className="text-[17px] font-black text-gray-900 mt-2 tabular-nums">{rm(it.price)}{it.unit === 'kg' ? <span className="text-[12px] font-bold text-gray-500">/kg</span> : ''}</p>
      {out && <p className="text-[10px] font-bold text-amber-700 mt-0.5">Store stock 0</p>}
      {!out && it.stock != null && it.stock <= 5 && <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{it.stock} left</p>}
    </button>
  )
}

function GroupTile({ g, onPick }: { g: PosProductGroup; onPick: (g: PosProductGroup) => void }) {
  const multi = g.items.length > 1
  return (
    <button type="button" onClick={() => onPick(g)}
      className={`relative text-left min-h-[116px] p-4 rounded-2xl bg-white border border-gray-200 active:bg-gray-100 active:scale-[0.98] transition ${g.stockZero ? 'opacity-60' : ''}`}>
      {g.hasKg && <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 h-5 rounded-full bg-gray-900 text-white"><Scale className="h-3 w-3" />kg</span>}
      <p className="text-[15px] font-extrabold text-gray-900 leading-tight line-clamp-2 pr-6">{g.name}</p>
      <p className="text-[12px] font-semibold text-gray-500 mt-1 truncate">{multi ? `${g.items.length} sizes` : (g.items[0].unit === 'kg' ? 'by weight' : g.items[0].variantName ?? '')}</p>
      <p className="text-[16px] font-black text-gray-900 mt-2 tabular-nums inline-flex items-center gap-1">
        {g.minPrice === g.maxPrice ? rm(g.minPrice) : `${rm(g.minPrice)} – ${rm(g.maxPrice)}`}
        {g.items.length === 1 && g.items[0].unit === 'kg' && <span className="text-[12px] font-bold text-gray-500">/kg</span>}
        {multi && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
      </p>
    </button>
  )
}

export function ProductGrid({ catalog, query, categoryId, onPick, onPickGroup }: {
  catalog: PosCatalog; query: string; categoryId: string; onPick: (item: PosCatalogItem) => void; onPickGroup: (g: PosProductGroup) => void
}) {
  const items = useMemo(() => filterCatalog(catalog, query, categoryId), [catalog, query, categoryId])
  // Peringkat varian untuk Kegemaran & carian; peringkat produk untuk kategori / Semua.
  const byVariant = !!query.trim() || categoryId === CAT_QUICK
  const groups = useMemo(() => (byVariant ? [] : groupByProduct(items)), [items, byVariant])
  if (items.length === 0) return <p className="text-center text-[13px] text-gray-400 py-12">No items{query ? ` for "${query}"` : ''}.</p>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
      {byVariant
        ? items.map(it => <ItemTile key={it.key} it={it} onPick={onPick} />)
        : groups.map(g => <GroupTile key={g.productId} g={g} onPick={g.items.length === 1 ? () => onPick(g.items[0]) : onPickGroup} />)}
    </div>
  )
}

/** Sheet pilih saiz/varian untuk satu produk — ketuk → tambah ke tiket. */
export function VariantSheet({ group, onPick }: { group: PosProductGroup; onPick: (item: PosCatalogItem) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {group.items.map(it => {
        const out = it.stock === 0
        return (
          <button key={it.key} type="button" onClick={() => onPick(it)}
            className={`min-h-[92px] rounded-2xl border border-gray-200 bg-white p-4 text-left active:bg-gray-100 ${out ? 'opacity-60' : ''}`}>
            <p className="text-[17px] font-extrabold text-gray-900 inline-flex items-center gap-1">{it.unit === 'kg' ? <><Scale className="h-3.5 w-3.5" /> By weight</> : (it.variantName ?? 'Standard')}</p>
            <p className="text-[16px] font-black text-gray-900 mt-1.5 tabular-nums">{rm(it.price)}{it.unit === 'kg' ? <span className="text-[12px] font-bold text-gray-500">/kg</span> : ''}</p>
            {out ? <p className="text-[10px] font-bold text-amber-700">Store stock 0</p> : it.stock != null && it.stock <= 5 ? <p className="text-[10px] font-semibold text-gray-400">{it.stock} left</p> : null}
          </button>
        )
      })}
    </div>
  )
}
