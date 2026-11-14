import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { computeTotals } from '@/lib/pos/money'
import type { PosCatalogItem, PosTicketCustomer, PosTicketDiscount, PosTicketLine, PosTicketPromo, PosTotals } from '@/lib/pos/types'

// Tiket POS semasa (zustand + persist localStorage) — tahan tutup tab / reload tengah jualan.
// Tiada pixel/tracking (berbeza dengan stores/cart.ts). Satu tiket aktif + senarai tiket tangguh.
// clientTxnId (kunci idempoten /api/pos/sales) DITUKAR pada setiap ubahan tiket: selepas hantar yang
// responsnya hilang, tiket yang diubah (tambah item / tukar kuantiti) mesti jadi jualan BARU — bukan
// dipulangkan sebagai pendua jualan lama dengan jumlah lama. Ulang tanpa ubahan → id sama → pendua (betul).
// approval = token kelulusan manager (PIN verify_only) untuk diskaun melebihi had / harga bawah katalog;
// dihantar bersama jualan, dibersihkan bila tiket baru.

export interface HeldTicket {
  id: string
  heldAt: string
  label: string
  clientTxnId: string
  lines: PosTicketLine[]
  discount: PosTicketDiscount | null
  promo: PosTicketPromo | null
  customer: PosTicketCustomer | null
  note: string | null
  approval?: string | null
}

interface PosTicketState {
  clientTxnId: string
  lines: PosTicketLine[]
  discount: PosTicketDiscount | null
  promo: PosTicketPromo | null
  customer: PosTicketCustomer | null
  note: string | null
  approval: string | null
  held: HeldTicket[]

  addItem: (item: PosCatalogItem, qty?: number) => void
  addCustom: (name: string, unitPrice: number, qty?: number) => void
  setQty: (lineId: string, qty: number) => void
  setUnitPrice: (lineId: string, price: number) => void
  setLineDiscount: (lineId: string, amount: number) => void
  removeLine: (lineId: string) => void
  setDiscount: (d: PosTicketDiscount | null) => void
  setPromo: (p: PosTicketPromo | null) => void
  setCustomer: (c: PosTicketCustomer | null) => void
  setNote: (n: string | null) => void
  setApproval: (token: string | null) => void
  hold: (label?: string) => void
  recall: (heldId: string) => void
  dropHeld: (heldId: string) => void
  reset: () => void
  totals: (cashRounding: boolean) => PosTotals
}

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
// Setiap ubahan kandungan tiket = kunci idempoten baru
const touch = () => ({ clientTxnId: newId() })

const empty = () => ({ clientTxnId: newId(), lines: [] as PosTicketLine[], discount: null, promo: null, customer: null, note: null, approval: null })

export const usePosTicket = create<PosTicketState>()(
  persist(
    (set, get) => ({
      ...empty(),
      held: [],

      addItem: (item, qty) => set(s => {
        const q = qty ?? (item.unit === 'kg' ? 0 : 1)
        if (item.unit === 'pcs') {
          const existing = s.lines.find(l => l.productId === item.productId && l.variantId === item.variantId && l.unit === 'pcs' && l.unitPrice === item.price)
          if (existing) return { ...touch(), lines: s.lines.map(l => l.lineId === existing.lineId ? { ...l, qty: l.qty + q } : l) }
        }
        const line: PosTicketLine = {
          lineId: newId(), productId: item.productId, variantId: item.variantId,
          name: item.name, variantName: item.unit === 'kg' ? null : item.variantName,
          // catalogPrice = harga yang katalog hidangkan untuk register ini (senarai harga/override) —
          // drift di admin = kasyer ubah harga baris, bukan beza kedai vs bazar (server tulis semula dari katalog)
          unit: item.unit, qty: q, unitPrice: item.price, catalogPrice: item.price,
          lineDiscount: 0, sellByWeight: item.unit === 'kg', sku: item.sku, barcode: item.barcode,
        }
        return { ...touch(), lines: [...s.lines, line] }
      }),

      addCustom: (name, unitPrice, qty = 1) => set(s => ({
        ...touch(),
        lines: [...s.lines, { lineId: newId(), productId: null, variantId: null, name, variantName: null, unit: 'pcs', qty, unitPrice, catalogPrice: null, lineDiscount: 0, sellByWeight: false, sku: null, barcode: null }],
      })),

      setQty: (lineId, qty) => set(s => qty <= 0
        ? { ...touch(), lines: s.lines.filter(l => l.lineId !== lineId) }
        : { ...touch(), lines: s.lines.map(l => l.lineId === lineId ? { ...l, qty } : l) }),
      setUnitPrice: (lineId, price) => set(s => ({ ...touch(), lines: s.lines.map(l => l.lineId === lineId ? { ...l, unitPrice: Math.max(0, price) } : l) })),
      setLineDiscount: (lineId, amount) => set(s => ({ ...touch(), lines: s.lines.map(l => l.lineId === lineId ? { ...l, lineDiscount: Math.max(0, amount) } : l) })),
      removeLine: (lineId) => set(s => ({ ...touch(), lines: s.lines.filter(l => l.lineId !== lineId) })),
      setDiscount: (discount) => set({ ...touch(), discount }),
      setPromo: (promo) => set({ ...touch(), promo }),
      setCustomer: (customer) => set({ ...touch(), customer }),
      setNote: (note) => set({ ...touch(), note }),
      setApproval: (approval) => set({ approval }),

      hold: (label) => set(s => {
        if (s.lines.length === 0) return {}
        const h: HeldTicket = {
          id: newId(), heldAt: new Date().toISOString(),
          label: label?.trim() || s.customer?.name || s.customer?.phone || `${s.lines.length} item`,
          clientTxnId: s.clientTxnId, lines: s.lines, discount: s.discount, promo: s.promo, customer: s.customer, note: s.note, approval: s.approval,
        }
        return { ...empty(), held: [h, ...s.held].slice(0, 20) }
      }),
      recall: (heldId) => set(s => {
        const h = s.held.find(x => x.id === heldId)
        if (!h) return {}
        // tiket semasa (jika ada) ditangguh dulu supaya tak hilang
        const current: HeldTicket[] = s.lines.length > 0
          ? [{ id: newId(), heldAt: new Date().toISOString(), label: s.customer?.name || s.customer?.phone || `${s.lines.length} item`, clientTxnId: s.clientTxnId, lines: s.lines, discount: s.discount, promo: s.promo, customer: s.customer, note: s.note, approval: s.approval }]
          : []
        return { clientTxnId: h.clientTxnId, lines: h.lines, discount: h.discount, promo: h.promo, customer: h.customer, note: h.note, approval: h.approval ?? null, held: [...current, ...s.held.filter(x => x.id !== heldId)] }
      }),
      dropHeld: (heldId) => set(s => ({ held: s.held.filter(x => x.id !== heldId) })),
      reset: () => set(empty()),

      totals: (cashRounding) => { const s = get(); return computeTotals(s.lines, s.discount, s.promo?.discount ?? 0, { cashRounding }) },
    }),
    { name: 'sf-pos-ticket', version: 1 },
  ),
)
