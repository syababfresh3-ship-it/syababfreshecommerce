import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartStore, Product, ProductVariant } from '@/types'

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product: Product, quantity: number = 1, variant: ProductVariant | null = null) => {
        set((state) => {
          const existing = state.items.find(
            (item) => item.product.id === product.id && (item.variant?.id ?? null) === (variant?.id ?? null)
          )
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id && (item.variant?.id ?? null) === (variant?.id ?? null)
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            }
          }
          return { items: [...state.items, { product, variant: variant ?? null, quantity }] }
        })
      },

      removeItem: (productId: string, variantId: string | null = null) => {
        set((state) => ({
          items: state.items.filter(
            (item) => !(item.product.id === productId && (item.variant?.id ?? null) === variantId)
          ),
        }))
      },

      updateQuantity: (productId: string, quantity: number, variantId: string | null = null) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId)
          return
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.product.id === productId && (item.variant?.id ?? null) === variantId
              ? { ...item, quantity }
              : item
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce(
          (total, item) => total + (item.variant?.price ?? item.product.price) * item.quantity,
          0
        )
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0)
      },
    }),
    { name: 'syababfresh-cart' }
  )
)
