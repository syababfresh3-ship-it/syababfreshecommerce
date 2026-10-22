import { create } from 'zustand'
import { lpTrackAddToCart } from '@/lib/lp-tracking'

export interface LpCartItem {
  productId: string
  variantId: string | null
  productName: string
  variantName: string | null
  qty: number
  unitPrice: number
  imageUrl: string | null
  // Variasi free_shipping (migration 141) → seluruh order percuma
  freeShip?: boolean
}

interface LpCartStore {
  items: LpCartItem[]
  addItem: (item: LpCartItem) => void
  removeItem: (productId: string, variantId: string | null) => void
  updateQty: (productId: string, variantId: string | null, qty: number) => void
  clear: () => void
  subtotal: () => number
  count: () => number
}

export const useLpCart = create<LpCartStore>((set, get) => ({
  items: [],

  // Meta Pixel AddToCart (22 Okt 2026) — di sini supaya SEMUA pemanggil addItem
  // (LpAddToCartBtn, LpLive, LpVideo) dikira tanpa ubah setiap komponen.
  addItem: (item) => { lpTrackAddToCart(item); set(state => {
    const existing = state.items.find(
      i => i.productId === item.productId && i.variantId === item.variantId
    )
    if (existing) {
      return {
        items: state.items.map(i =>
          i.productId === item.productId && i.variantId === item.variantId
            ? { ...i, qty: i.qty + item.qty }
            : i
        ),
      }
    }
    return { items: [...state.items, item] }
  }) },

  removeItem: (productId, variantId) => set(state => ({
    items: state.items.filter(
      i => !(i.productId === productId && i.variantId === variantId)
    ),
  })),

  updateQty: (productId, variantId, qty) => {
    if (qty <= 0) { get().removeItem(productId, variantId); return }
    set(state => ({
      items: state.items.map(i =>
        i.productId === productId && i.variantId === variantId ? { ...i, qty } : i
      ),
    }))
  },

  clear: () => set({ items: [] }),
  subtotal: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),
  count: () => get().items.reduce((sum, i) => sum + i.qty, 0),
}))
