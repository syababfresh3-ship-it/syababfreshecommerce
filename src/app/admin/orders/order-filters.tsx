'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X, CalendarDays, Tag } from 'lucide-react'
import { useRef, useState } from 'react'

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
  { value: '',          label: 'Semua tarikh' },
  { value: 'hari-ini',  label: 'Today' },
  { value: 'semalam',   label: 'Yesterday' },
  { value: '7-hari',    label: '7 Days' },
  { value: 'bulan-ini', label: 'This Month' },
]

const payTabs = [
  { value: '',        label: 'Semua bayaran' },
  { value: 'unpaid',  label: '🔴 Belum Bayar' },
  { value: 'paid',    label: '🟢 Sudah Bayar' },
]

export function OrderFilters({ activeStatus, activeSearch, activeDate, activeLp, activeFrom, activeTo, activePay, landingPages = [] }: {
  activeStatus?: string
  activeSearch?: string
  activeDate?: string
  activeLp?: string
  activeFrom?: string
  activeTo?: string
  activePay?: string
  landingPages?: { id: string; title: string; slug: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const [from, setFrom] = useState(activeFrom ?? '')
  const [to, setTo] = useState(activeTo ?? '')

  // Mutasi banyak param dalam satu push (elak setParam berturut yang saling tindih)
  function pushParams(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    router.push(`/admin/orders?${params.toString()}`)
  }

  function setParam(key: string, val: string) {
    pushParams((p) => { if (val) p.set(key, val); else p.delete(key) })
  }

  function handleSearch(e: React.SyntheticEvent) {
    e.preventDefault()
    const q = inputRef.current?.value.trim() ?? ''
    setParam('q', q)
  }

  function clearSearch() {
    setParam('q', '')
    if (inputRef.current) inputRef.current.value = ''
  }

  // Julat custom mengatasi preset — set from/to, buang preset date
  function applyRange() {
    pushParams((p) => {
      if (from) p.set('from', from); else p.delete('from')
      if (to) p.set('to', to); else p.delete('to')
      p.delete('date')
    })
  }

  function clearRange() {
    setFrom(''); setTo('')
    pushParams((p) => { p.delete('from'); p.delete('to') })
  }

  // Preset dipilih → buang julat custom
  function setPreset(value: string) {
    setFrom(''); setTo('')
    pushParams((p) => { if (value) p.set('date', value); else p.delete('date'); p.delete('from'); p.delete('to') })
  }

  const hasActiveFilters = !!(activeStatus || activeSearch || activeDate || activeLp || activeFrom || activeTo || activePay)
  const hasCustomRange = !!(activeFrom || activeTo)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
      {/* Row 1: Search + LP + Date preset */}
      <div className="flex flex-col lg:flex-row gap-2">
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

        {/* LP filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Tag className="h-3.5 w-3.5 text-rose-400 shrink-0 hidden sm:block" />
          <select
            value={activeLp ?? ''}
            onChange={(e) => setParam('lp', e.target.value)}
            className="py-2.5 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-300 max-w-[200px]"
          >
            <option value="">Semua LP</option>
            <option value="storefront">Storefront sahaja</option>
            {landingPages.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        {/* Payment filter */}
        <div className="flex items-center gap-1.5 shrink-0">
          <select
            value={activePay ?? ''}
            onChange={(e) => setParam('pay', e.target.value)}
            className="py-2.5 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-300"
          >
            {payTabs.map((tab) => (
              <option key={tab.value} value={tab.value}>{tab.label}</option>
            ))}
          </select>
        </div>

        {/* Date preset dropdown */}
        <div className="flex items-center gap-1.5 shrink-0">
          <CalendarDays className="h-3.5 w-3.5 text-gray-400 shrink-0 hidden sm:block" />
          <select
            value={hasCustomRange ? '' : (activeDate ?? '')}
            onChange={(e) => setPreset(e.target.value)}
            className="py-2.5 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {dateTabs.map((tab) => (
              <option key={tab.value} value={tab.value}>{tab.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 1b: Custom date range (calendar) */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">Dari</label>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">Hingga</label>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <button onClick={applyRange} disabled={!from && !to}
          className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors">
          Tapis Tarikh
        </button>
        {hasCustomRange && (
          <button onClick={clearRange} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <X className="h-3 w-3" />Reset tarikh
          </button>
        )}
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
                isActive ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
