'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'

const options = [
  { value: '', label: 'Disyorkan' },
  { value: 'price_asc', label: 'Harga: Rendah ke Tinggi' },
  { value: 'price_desc', label: 'Harga: Tinggi ke Rendah' },
  { value: 'name', label: 'Nama A–Z' },
]

export function SortFilter({ activeSort }: { activeSort?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('sort', e.target.value)
    } else {
      params.delete('sort')
    }
    router.push(`/products?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <ArrowUpDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      <select
        value={activeSort ?? ''}
        onChange={handleChange}
        className="text-xs text-gray-600 bg-transparent focus:outline-none cursor-pointer"
        suppressHydrationWarning
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
