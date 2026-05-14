'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useRef } from 'react'

const tabs = [
  { value: '',           label: 'Semua',      dot: '' },
  { value: 'pending',    label: 'Menunggu',   dot: 'bg-yellow-400' },
  { value: 'confirmed',  label: 'Disahkan',   dot: 'bg-blue-400' },
  { value: 'preparing',  label: 'Disediakan', dot: 'bg-purple-400' },
  { value: 'delivering', label: 'Dihantar',   dot: 'bg-orange-400' },
  { value: 'delivered',  label: 'Selesai',    dot: 'bg-green-400' },
  { value: 'cancelled',  label: 'Dibatal',    dot: 'bg-red-400' },
]

export function OrderFilters({ activeStatus, activeSearch }: { activeStatus?: string; activeSearch?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  function setStatus(val: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (val) params.set('status', val)
    else params.delete('status')
    router.push(`/admin/orders?${params.toString()}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = inputRef.current?.value.trim() ?? ''
    const params = new URLSearchParams(searchParams.toString())
    if (q) params.set('q', q)
    else params.delete('q')
    router.push(`/admin/orders?${params.toString()}`)
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    router.push(`/admin/orders?${params.toString()}`)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-3 mb-4">
      <form onSubmit={handleSearch} className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          defaultValue={activeSearch}
          placeholder="Cari no. pesanan, nama atau telefon..."
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm"
        />
        {activeSearch && (
          <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map((tab) => {
          const isActive = (activeStatus ?? '') === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.dot && (
                <span className={`h-1.5 w-1.5 rounded-full ${tab.dot} ${isActive ? 'opacity-80' : ''}`} />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
