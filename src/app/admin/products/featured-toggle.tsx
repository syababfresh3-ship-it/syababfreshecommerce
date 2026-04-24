'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface FeaturedToggleProps {
  id: string
  isFeatured: boolean
}

export function FeaturedToggle({ id, isFeatured }: FeaturedToggleProps) {
  const [featured, setFeatured] = useState(isFeatured)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('products')
      .update({ is_featured: !featured })
      .eq('id', id)

    if (error) {
      toast.error('Gagal kemaskini')
    } else {
      setFeatured(!featured)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={featured ? 'Nyahfeatured' : 'Mark as featured'}
      className={`text-xl transition-opacity ${loading ? 'opacity-40 cursor-not-allowed' : 'hover:scale-110 active:scale-95 cursor-pointer'} ${featured ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
    >
      ★
    </button>
  )
}
