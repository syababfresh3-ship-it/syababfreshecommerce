import { create } from 'zustand'

export interface LpCartItem {
  productId: string
  variantId: string | null
  productName: string
  variantName: string | null
  qty: number
  unitPrice: number
  imageUrl: string | null
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

  addItem: (item) => set(state => {
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
  }),

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
