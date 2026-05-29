'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X, CalendarDays } from 'lucide-react'
import { useRef } from 'react'

const statusTabs = [
  { value: '',           label: 'All',      dot: '' },
  { value: 'pending',    label: 'Pending',   dot: 'bg-yellow-400' },
  { value: 'confirmed',  label: 'Confirmed',   dot: 'bg-blue-400' },
  { value: 'preparing',  label: 'Preparing', dot: 'bg-purple-400' },
  { value: 'delivering', label: 'Delivering',   dot: 'bg-orange-400' },
  { value: 'delivered',  label: 'Delivered',    dot: 'bg-green-400' },
  { value: 'cancelled',  label: 'Cancelled',    dot: 'bg-red-400' },
]

const dateTabs = [
  { value: '',          label: 'All' },
  { value: 'hari-ini',  label: 'Today' },
  { value: 'semalam',   label: 'Yesterday' },
  { value: '7-hari',    label: '7 Days' },
  { value: 'bulan-ini', label: 'This Month' },
]

export function OrderFilters({ activeStatus, activeSearch, activeDate }: {
  activeStatus?: string
  activeSearch?: string
  activeDate?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)

  function setParam(key: string, val: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (val) params.set(key, val)
    else params.delete(key)
    router.push(`/admin/orders?${params.toString()}`)
  }

  function handleSearch(e: React.SyntheticEvent) {
    e.preventDefault()
    const q = inputRef.current?.value.trim() ?? ''
    setParam('q', q)
  }

  function clearSearch() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    router.push(`/admin/orders?${params.toString()}`)
    if (inputRef.current) inputRef.current.value = ''
  }

  const hasActiveFilters = !!(activeStatus || activeSearch || activeDate)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
      {/* Row 1: Search + Date */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            defaultValue={activeSearch}
            placeholder="Search order no., name or phone..."
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-gray-50 placeholder:text-gray-400"
          />
          {activeSearch && (
            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* Date toggle group */}
        <div className="flex items-center gap-1.5 shrink-0">
          <CalendarDays className="h-3.5 w-3.5 text-gray-400 shrink-0 hidden sm:block" />
          <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-xl">
            {dateTabs.map((tab) => {
              const isActive = (activeDate ?? '') === tab.value
              return (
                <button
                  key={tab.value}
                  onClick={() => setParam('date', tab.value)}
                  className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100" />

      {/* Row 2: Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {statusTabs.map((tab) => {
          const isActive = (activeStatus ?? '') === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => setParam('status', tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.dot && (
                <span className={`h-1.5 w-1.5 rounded-full ${tab.dot} ${isActive ? 'opacity-70' : ''}`} />
              )}
              {tab.label}
            </button>
          )
        })}

        {hasActiveFilters && (
          <button
            onClick={() => router.push('/admin/orders')}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="h-3 w-3" />
            Kosongkan filter
          </button>
        )}
      </div>
    </div>
  )
}
