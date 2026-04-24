'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle()
        .then(({ data }) => setSaved(!!data))
    })
  }, [productId])

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Sila log masuk dahulu'); return }

    setLoading(true)
    if (saved) {
      await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', productId)
      setSaved(false)
      toast.success('Dibuang dari senarai simpan')
    } else {
      await supabase.from('wishlists').insert({ user_id: user.id, product_id: productId })
      setSaved(true)
      toast.success('Disimpan ke senarai!')
    }
    setLoading(false)
  }

  if (!mounted) return null

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`p-1.5 rounded-full transition-colors ${saved ? 'text-red-500' : 'text-gray-300 hover:text-red-400'} ${className ?? ''}`}
      aria-label={saved ? 'Buang dari senarai simpan' : 'Simpan produk'}
    >
      <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
    </button>
  )
}
