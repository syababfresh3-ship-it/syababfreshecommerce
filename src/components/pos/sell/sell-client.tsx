'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Search, X, ShoppingBasket, RefreshCw, ScanLine, Store } from 'lucide-react'
import { useHidScanner } from '@/components/pos/use-hid-scanner'
import { CameraScanner } from '@/components/pos/camera-scanner'
import { usePosCatalog } from '@/components/pos/use-pos-catalog'
import { CategoryChips, CategoryGrid, ProductGrid, VariantSheet, CAT_BROWSE, CAT_QUICK, filterCatalog, type PosProductGroup } from '@/components/pos/sell/product-grid'
import { TicketPanel } from '@/components/pos/sell/ticket-panel'
import { WeightKeypad } from '@/components/pos/sell/weight-keypad'
import { LineSheet } from '@/components/pos/sell/line-sheet'
import { DiscountSheet } from '@/components/pos/sell/discount-sheet'
import { CustomerSheet } from '@/components/pos/sell/customer-sheet'
import { HeldSheet, CustomItemSheet } from '@/components/pos/sell/misc-sheets'
import { PayView, type SaleDone } from '@/components/pos/pay/pay-view'
import { SuccessView } from '@/components/pos/pay/success-view'
import { PosSheet } from '@/components/pos/sheet'
import { PinPad } from '@/components/pos/pin-pad'
import { usePosTicket } from '@/lib/stores/pos-ticket'
import { usePosSession } from '@/lib/stores/pos-session'
import { rm } from '@/lib/pos/money'
import type { PosCatalogItem, PosTicketLine } from '@/lib/pos/types'

// Terminal satu laluan: paparan grid → bayar → berjaya dalam satu page klien (tiada navigasi RSC —
// sedia untuk offline Fasa 2). Tablet landskap: grid kiri (baki ruang), tiket kanan lebar tetap.
// Telefon: grid penuh + bar bawah → tiket sebagai sheet. UI dalam Bahasa Inggeris.
// Barcode: (a) scanner HID global (useHidScanner — tanpa fokus kotak carian), (b) kotak carian + Enter,
// (c) kamera (CameraScanner dalam sheet, berterusan). Padanan: barcode tepat → SKU tepat.

type Sheet =
  | null
  | { type: 'weight'; item: PosCatalogItem }
  | { type: 'line'; line: PosTicketLine }
  | { type: 'discount' } | { type: 'customer' } | { type: 'held' } | { type: 'custom' } | { type: 'ticket' } | { type: 'pin' }
  | { type: 'variants'; group: PosProductGroup }
  | { type: 'camera' }

export function SellClient() {
  const { catalog, loading, error, refresh } = usePosCatalog()
  const ticket = usePosTicket()
  const { cashier, isAdmin, shift, shiftLoaded, settings } = usePosSession()
  // Kedai mesti dibuka (shift) sebelum jual — boleh dimatikan di Admin → POS Settings (requireShift)
  const storeClosed = settings?.requireShift !== false && shiftLoaded && !shift
  const [view, setView] = useState<'grid' | 'pay' | 'success'>('grid')
  const [done, setDone] = useState<SaleDone | null>(null)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>(CAT_BROWSE)   // lalai: tab Categories (atau Favourites bila ada quick key)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [lastScan, setLastScan] = useState<{ code: string; label: string | null } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const totals = ticket.totals(false)

  // Auto pilih tab Favourites SEKALI bila katalog pertama tiba (corak 'adjust state during render', bukan effect)
  const [autoCatDone, setAutoCatDone] = useState(false)
  if (catalog && !autoCatDone) { setAutoCatDone(true); if (cat === CAT_BROWSE && catalog.items.some(i => i.isQuickKey)) setCat(CAT_QUICK) }

  const pick = useCallback((item: PosCatalogItem) => {
    if (item.unit === 'kg') { setSheet({ type: 'weight', item }); return }
    ticket.addItem(item, 1)
    if (navigator.vibrate) navigator.vibrate(10)
  }, [ticket])

  // Imbasan (HID global / kamera): barcode tepat → SKU tepat → tambah; tiada → toast.
  // Sheet terbuka: pad timbang / PIN → abaikan imbasan dengan amaran (jangan hilangkan input separuh jalan);
  // sheet lain (edit baris, diskaun, pelanggan, tangguh, item manual, tiket, varian) → tutup dan tambah item.
  const onScan = useCallback((raw: string) => {
    const code = raw.trim()
    if (!code || !catalog) return
    if (sheet && sheet.type !== 'camera') {
      if (sheet.type === 'weight' || sheet.type === 'pin') { toast.error(sheet.type === 'weight' ? 'Finish entering the weight first' : 'Enter the PIN first'); return }
      setSheet(null)
    }
    const lc = code.toLowerCase()
    const hit = catalog.items.find(i => i.barcode === code) ?? catalog.items.find(i => i.sku && i.sku.toLowerCase() === lc)
    if (!hit) { setLastScan({ code, label: null }); toast.error(`No item with barcode ${code}`); return }
    const label = hit.unit === 'kg' ? `${hit.name} · by weight` : `${hit.name}${hit.variantName ? ` ${hit.variantName}` : ''}`
    setLastScan({ code, label })
    if (sheet?.type !== 'camera') toast.success(hit.unit === 'kg' ? `${label} — enter weight` : `Added ${label}`, { duration: 1500 })
    pick(hit)
  }, [catalog, pick, sheet])
  // Scanner HID aktif sepanjang paparan grid — termasuk semasa sheet terbuka, supaya Enter dari scanner ditelan
  // (preventDefault) dan tak "mengklik" butang pad yang kebetulan berfokus (kotak carian berfokus dikendalikan onSearchKey)
  useHidScanner(view === 'grid' && !!catalog && !storeClosed, onScan)

  // Enter dalam carian: satu padanan tepat (barcode/sku/nama) → terus tambah (scanner HID yang menaip ke kotak ini juga)
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !catalog) return
    const hits = filterCatalog(catalog, query, cat)
    if (hits.length === 1) { pick(hits[0]); setQuery(''); e.preventDefault() }
  }

  const charge = () => {
    if (!cashier && !isAdmin) { setSheet({ type: 'pin' }); return }
    setSheet(null); setView('pay')
  }
  const onDone = (r: SaleDone) => { setDone(r); setView('success') }
  const newSale = () => { ticket.reset(); setDone(null); setView('grid'); setQuery('') }

  if (view === 'pay') return <PayView onBack={() => setView('grid')} onDone={onDone} onPinRequired={() => setSheet({ type: 'pin' })} />
  if (view === 'success' && done) return <SuccessView sale={done} customerPhone={ticket.customer?.phone || null} customerName={ticket.customer?.name ?? null} onNew={newSale} />

  if (storeClosed) {
    return (
      <div className="flex-1 grid place-items-center p-6">
        <div className="max-w-sm w-full text-center rounded-3xl bg-white border border-gray-200 p-8 space-y-4">
          <span className="mx-auto h-14 w-14 grid place-items-center rounded-2xl bg-gray-100"><Store className="h-7 w-7 text-gray-700" /></span>
          <div><h1 className="text-[20px] font-black">Store is closed</h1><p className="text-[14px] text-gray-500 mt-1">Open the store with your opening cash float to start selling.</p></div>
          <Link href="/pos/shift" className="h-14 rounded-2xl text-white text-[16px] font-extrabold grid place-items-center" style={{ background: '#E11D2A' }}>Open store</Link>
        </div>
      </div>
    )
  }

  const panel = (
    <TicketPanel onCharge={charge} onEditLine={l => setSheet({ type: 'line', line: l })} onDiscount={() => setSheet({ type: 'discount' })} onCustomer={() => setSheet({ type: 'customer' })} onHeld={() => setSheet({ type: 'held' })} onCustom={() => setSheet({ type: 'custom' })} />
  )

  return (
    <div className="flex-1 min-h-0 lg:flex">
      {/* Grid produk */}
      <section className="lg:flex-1 lg:min-w-0 flex flex-col min-h-0 p-3 gap-3 pb-24 lg:pb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onSearchKey} placeholder="Search products / scan barcode" enterKeyHint="search"
              className="w-full h-12 pl-9 pr-10 rounded-2xl bg-white border border-gray-200 text-[15px] font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900" />
            {query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-full text-gray-500"><X className="h-4 w-4" /></button>}
          </div>
          <button type="button" onClick={() => setSheet({ type: 'camera' })} aria-label="Scan barcode with camera" className="h-12 w-12 grid place-items-center rounded-2xl bg-white border border-gray-200 text-gray-700"><ScanLine className="h-5 w-5" /></button>
          <button type="button" onClick={() => refresh(true)} aria-label="Refresh catalog" className="h-12 w-12 grid place-items-center rounded-2xl bg-white border border-gray-200 text-gray-600"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        {catalog && !query && <CategoryChips catalog={catalog} value={cat} onChange={setCat} />}
        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          {!catalog && loading && <p className="text-center text-[13px] text-gray-400 py-12">Loading catalog…</p>}
          {!catalog && error && <p className="text-center text-[13px] text-red-600 py-12">{error}</p>}
          {catalog && (cat === CAT_BROWSE && !query.trim()
            ? <CategoryGrid catalog={catalog} value={cat} onPick={setCat} />
            : <ProductGrid catalog={catalog} query={query} categoryId={cat} onPick={pick} onPickGroup={g => setSheet({ type: 'variants', group: g })} />)}
        </div>
      </section>

      {/* Tiket — panel kanan lebar tetap (tablet/laptop) */}
      <aside className="hidden lg:flex lg:w-[400px] xl:w-[440px] lg:shrink-0 flex-col min-h-0 bg-white border-l border-gray-200 p-3">
        {panel}
      </aside>

      {/* Bar bawah (telefon) */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="px-3 py-2.5 flex items-center gap-3">
          <button type="button" onClick={() => setSheet({ type: 'ticket' })} className="flex-1 text-left inline-flex items-center gap-2">
            <span className="relative h-10 w-10 grid place-items-center rounded-xl bg-gray-100"><ShoppingBasket className="h-5 w-5" />{totals.lineCount > 0 && <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-gray-900 text-white text-[10px] font-black grid place-items-center">{totals.lineCount}</span>}</span>
            <span><span className="block text-[11px] font-semibold text-gray-500 leading-none">Ticket</span><span className="block text-[17px] font-black tabular-nums leading-tight">{rm(totals.total)}</span></span>
          </button>
          <button type="button" onClick={charge} disabled={totals.lineCount === 0} className="h-12 px-5 rounded-2xl text-white text-[15px] font-extrabold disabled:opacity-40" style={{ background: '#E11D2A' }}>Pay</button>
        </div>
      </div>

      {/* Sheets */}
      <PosSheet open={sheet?.type === 'ticket'} onClose={() => setSheet(null)} title="Ticket">
        <div className="h-[70dvh]">{panel}</div>
      </PosSheet>
      <PosSheet open={sheet?.type === 'variants'} onClose={() => setSheet(null)} title={sheet?.type === 'variants' ? `${sheet.group.name} — choose size` : ''} wide>
        {sheet?.type === 'variants' && <VariantSheet group={sheet.group} onPick={it => { setSheet(null); pick(it) }} />}
      </PosSheet>
      <PosSheet open={sheet?.type === 'weight'} onClose={() => setSheet(null)} title="Enter weight">
        {sheet?.type === 'weight' && <WeightKeypad name={sheet.item.name} pricePerKg={sheet.item.price} onConfirm={kg => { ticket.addItem(sheet.item, kg); setSheet(null) }} />}
      </PosSheet>
      <PosSheet open={sheet?.type === 'line'} onClose={() => setSheet(null)} title="Edit line">
        {sheet?.type === 'line' && <LineSheet line={ticket.lines.find(l => l.lineId === sheet.line.lineId) ?? sheet.line} onClose={() => setSheet(null)} />}
      </PosSheet>
      <PosSheet open={sheet?.type === 'discount'} onClose={() => setSheet(null)} title="Ticket discount"><DiscountSheet onClose={() => setSheet(null)} /></PosSheet>
      <PosSheet open={sheet?.type === 'customer'} onClose={() => setSheet(null)} title="Customer"><CustomerSheet onClose={() => setSheet(null)} /></PosSheet>
      <PosSheet open={sheet?.type === 'held'} onClose={() => setSheet(null)} title="Held tickets"><HeldSheet onClose={() => setSheet(null)} /></PosSheet>
      <PosSheet open={sheet?.type === 'custom'} onClose={() => setSheet(null)} title="Other item"><CustomItemSheet onClose={() => setSheet(null)} /></PosSheet>
      <PosSheet open={sheet?.type === 'pin'} onClose={() => setSheet(null)} title="Enter cashier PIN to continue"><PinPad onDone={() => { setSheet(null); setView('pay') }} /></PosSheet>
      <PosSheet open={sheet?.type === 'camera'} onClose={() => setSheet(null)} title="Scan barcode">
        {sheet?.type === 'camera' && (
          <div className="space-y-3">
            <CameraScanner onScan={onScan} lastLabel={lastScan?.label ?? null} />
            <div className="flex items-center justify-between rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3">
              <span className="text-[13px] font-semibold text-gray-600">Ticket · {totals.lineCount} {totals.lineCount === 1 ? 'item' : 'items'}</span>
              <span className="text-[17px] font-black tabular-nums">{rm(totals.total)}</span>
            </div>
            <button type="button" onClick={() => setSheet(null)} className="w-full h-12 rounded-2xl bg-gray-900 text-white text-[15px] font-extrabold">Done</button>
          </div>
        )}
      </PosSheet>
    </div>
  )
}
