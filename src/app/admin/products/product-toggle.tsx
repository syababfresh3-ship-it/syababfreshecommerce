'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface ProductToggleProps {
  id: string
  isActive: boolean
}

export function ProductToggle({ id, isActive }: ProductToggleProps) {
  const [active, setActive] = useState(isActive)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !active }),
    })
    if (!res.ok) {
      toast.error('Failed update status')
    } else {
      setActive(!active)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        active ? 'bg-green-500' : 'bg-gray-300'
      } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
