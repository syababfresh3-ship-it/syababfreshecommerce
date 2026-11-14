'use client'

// Toggle "POS" — papar/sorok produk di katalog POS tanpa matikan is_active / storefront.
// Menulis pos_product_settings.is_hidden (baris peringkat produk) melalui API yang sama
// dengan Admin › POS Products, jadi kedua-dua skrin sentiasa selari.
import { useState } from 'react'
import { toast } from 'sonner'

export function PosToggle({ id, show }: { id: string; show: boolean }) {
  const [on, setOn] = useState(show)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const res = await fetch('/api/admin/pos/product-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: id, variant_id: null, patch: { is_hidden: on } }),
    })
    if (!res.ok) toast.error('Gagal kemas kini POS')
    else { setOn(!on); toast.success(!on ? 'Ditunjuk di POS' : 'Disorok dari POS') }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={on ? 'Nampak di katalog POS' : 'Disorok dari POS'}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        on ? 'bg-gray-800' : 'bg-gray-300'
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
