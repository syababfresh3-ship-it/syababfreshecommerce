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
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { initRef.current = 'done'; return }

      const { data } = await supabase
        .from('cart_items')
        .select('product_id, quantity, products(id, name, price, image_url, unit, slug)')
        .eq('user_id', user.id)

      if (data) {
        const store = useCartStore.getState()
        for (const row of data) {
          if (row.products && !store.items.find(i => i.product.id === row.product_id)) {
            store.addItem(row.products as any, row.quantity)
          }
        }
      }

      initRef.current = 'done'
    })
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
