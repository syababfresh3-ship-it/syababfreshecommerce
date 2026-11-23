import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartStore, Product, ProductVariant } from '@/types'
import { trackAddToCart } from '@/lib/tracking'
import { readAff } from '@/lib/affiliate-attribution'

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product: Product, quantity: number = 1, variant: ProductVariant | null = null) => {
        const price = variant ? Number(variant.price) : Number(product.price)
        trackAddToCart(product.name, price, quantity)
        const aff = readAff(product.slug)   // attribution affiliate last-click untuk produk ni
        set((state) => {
          const existing = state.items.find(
            (item) => item.product.id === product.id && (item.variant?.id ?? null) === (variant?.id ?? null)
          )
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.product.id === product.id && (item.variant?.id ?? null) === (variant?.id ?? null)
                  // last-click menang: kemas kini affCode jika ada klik baru
                  ? { ...item, quantity: item.quantity + quantity, affCode: aff?.code ?? item.affCode ?? null, affAt: aff?.at ?? item.affAt ?? null, affClick: aff?.click ?? item.affClick ?? null }
                  : item
              ),
            }
          }
          return { items: [...state.items, { product, variant: variant ?? null, quantity, affCode: aff?.code ?? null, affAt: aff?.at ?? null, affClick: aff?.click ?? null }] }
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
