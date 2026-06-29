'use client'

// Toggle "Show in storefront" — sorok/papar produk di katalog storefront tanpa
// matikan is_active (duplicate landing-page kekal boleh dibeli via link terus).
import { useState } from 'react'
import { toast } from 'sonner'

export function StorefrontToggle({ id, show }: { id: string; show: boolean }) {
  const [on, setOn] = useState(show)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_in_storefront: !on }),
    })
    if (!res.ok) toast.error('Gagal kemas kini')
    else { setOn(!on); toast.success(!on ? 'Ditunjuk di storefront' : 'Disorok dari storefront') }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={on ? 'Nampak di katalog storefront' : 'Disorok dari katalog (backend/landing je)'}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        on ? 'bg-blue-500' : 'bg-gray-300'
      } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
