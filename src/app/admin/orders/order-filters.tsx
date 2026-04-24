'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const tabs = [
  { value: '', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'confirmed', label: 'Disahkan' },
  { value: 'preparing', label: 'Disediakan' },
  { value: 'delivering', label: 'Dihantar' },
  { value: 'delivered', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatal' },
]

export function OrderFilters({ activeStatus }: { activeStatus?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setStatus(val: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (val) params.set('status', val)
    else params.delete('status')
    router.push(`/admin/orders?${params.toString()}`)
  }

  return (
    <div className="flex gap-1.5 flex-wrap mb-5">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setStatus(tab.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            (activeStatus ?? '') === tab.value
              ? 'bg-brand-red-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
