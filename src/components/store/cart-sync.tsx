'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/lib/stores/cart'

export function CartSync() {
  const { items } = useCartStore()
  const initRef = useRef<'idle' | 'loading' | 'done'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Sync cart across tabs — when another tab modifies localStorage, rehydrate this tab
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'syababfresh-cart') {
        useCartStore.persist.rehydrate()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Load server cart once on mount and merge into local store
  useEffect(() => {
    if (initRef.current !== 'idle') return
    initRef.current = 'loading'

    const supabase = createClient()
    ;(async () => {
      const { data: authData } = await supabase.auth.getUser() as any
      const user = authData?.user
      if (!user) { initRef.current = 'done'; return }

      const { data: cartData } = await supabase
        .from('cart_items')
        .select('product_id, quantity, products(id, name, price, image_url, unit, slug)')
        .eq('user_id', user.id)

      if (cartData) {
        const store = useCartStore.getState()
        const freshProducts: Record<string, any> = {}
        for (const row of cartData as any[]) {
          if (!row.products) continue
          freshProducts[row.product_id] = row.products
          if (!store.items.find((i: any) => i.product.id === row.product_id)) {
            store.addItem(row.products as any, row.quantity)
          }
        }
        // Refresh product data (image_url, price, etc.) for items already in store
        const hasFresh = cartData.length > 0
        if (hasFresh) {
          useCartStore.setState((state) => ({
            items: state.items.map((item) => {
              const fresh = freshProducts[item.product?.id]
              return fresh ? { ...item, product: { ...item.product, ...fresh } } : item
            }),
          }))
        }
      }

      initRef.current = 'done'
    })()
  }, [])

  // Debounced sync to server on every cart change (after init)
  useEffect(() => {
    if (initRef.current !== 'done') return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('cart_items').delete().eq('user_id', user.id)

      if (items.length > 0) {
        await supabase.from('cart_items').insert(
          items.map(({ product, quantity }) => ({
            user_id: user.id,
            product_id: product.id,
            quantity,
          }))
        )
      }
    }, 1500)

    return () => clearTimeout(timerRef.current)
  }, [items])

  return null
}
