'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Users, Star, Crown, Leaf, ChevronRight } from 'lucide-react'
import { CreateUserForm } from './create-user-form'
import { SEGMENT_CONFIG, type Segment } from './segment-utils'

interface Customer {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  total_points: number
  total_spend: number
  created_at: string
  last_order_at: string | null
  order_count: number
  segment: Segment
  loyalty_tiers?: { name: string } | null
}

const TIER_STYLES: Record<string, { cls: string; icon: typeof Leaf }> = {
  'Hijau':    { cls: 'bg-green-50 text-green-700 border-green-200',    icon: Leaf },
  'Emas':     { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: Star },
  'Platinum': { cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: Crown },
}

const AVATAR_COLORS = [
  'bg-red-100 text-red-600',
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-orange-100 text-orange-600',
  'bg-purple-100 text-purple-600',
  'bg-teal-100 text-teal-600',
]

function avatarColor(id: string) {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function TierBadge({ name }: { name: string }) {
  const s = TIER_STYLES[name] ?? { cls: 'bg-gray-50 text-gray-500 border-gray-200', icon: Leaf }
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${s.cls}`}>
      <Icon className="h-3 w-3" />
      {name}
    </span>
  )
}

function SegmentBadge({ segment }: { segment: Segment }) {
  const cfg = SEGMENT_CONFIG[segment]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border ${cfg.color}`}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}

const SEGMENT_ORDER: Array<Segment | 'all'> = ['all', 'vip', 'active', 'new', 'at_risk', 'inactive', 'no_orders']

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [showForm, setShowForm] = useState(false)
  const [q, setQ] = useState('')
  const [activeSegment, setActiveSegment] = useState<Segment | 'all'>('all')

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: customers.length }
    for (const c of customers) {
      counts[c.segment] = (counts[c.segment] ?? 0) + 1
    }
    return counts
  }, [customers])

  const filtered = useMemo(() => {
    let list = activeSegment === 'all' ? customers : customers.filter(c => c.segment === activeSegment)
    if (q.trim()) {
      const lower = q.toLowerCase()
      list = list.filter(c =>
        (c.full_name ?? '').toLowerCase().includes(lower) ||
        (c.email ?? '').toLowerCase().includes(lower) ||
        (c.phone ?? '').includes(lower)
      )
    }
    return list
  }, [customers, q, activeSegment])

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pelanggan</h1>
          <p className="text-sm text-gray-400 mt-0.5">{customers.length} pelanggan berdaftar</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Pelanggan Baru
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && <CreateUserForm onClose={() => setShowForm(false)} />}

      {/* Segment filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SEGMENT_ORDER.map(seg => {
          const count = segmentCounts[seg] ?? 0
          const isAll = seg === 'all'
          const cfg = isAll ? null : SEGMENT_CONFIG[seg]
          const isActive = activeSegment === seg
          return (
            <button
              key={seg}
              onClick={() => setActiveSegment(seg)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                isActive
                  ? isAll
                    ? 'bg-gray-900 text-white border-gray-900'
                    : `${cfg!.color} ring-2 ring-offset-1 ring-current`
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}
            >
              {isAll ? '👥' : cfg!.emoji} {isAll ? 'Semua' : cfg!.label}
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? 'bg-white/20 text-inherit' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4 w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Cari nama, email, telefon..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm"
        />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-gray-400 py-16">
            <Users className="h-10 w-10 text-gray-200" />
            <p className="font-medium text-sm">{q ? `Tiada hasil untuk "${q}"` : 'Tiada pelanggan dalam segmen ini'}</p>
          </div>
        ) : filtered.map((customer) => {
          const tierName = customer.loyalty_tiers?.name ?? 'Hijau'
          const initials = (customer.full_name ?? '?').charAt(0).toUpperCase()
          return (
            <a
              key={customer.id}
              href={`/admin/customers/${customer.id}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3 block"
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${avatarColor(customer.id)}`}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{customer.full_name ?? '—'}</p>
                <p className="text-xs text-gray-400 truncate">{customer.phone ?? customer.email ?? '—'}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <SegmentBadge segment={customer.segment} />
                  <TierBadge name={tierName} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-900 text-sm">RM{Number(customer.total_spend).toFixed(0)}</p>
                <p className="text-xs text-gray-400">{customer.order_count} pesanan</p>
              </div>
            </a>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pelanggan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefon</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Segmen</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Pesanan</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah Belanja</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Terakhir</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Users className="h-10 w-10 text-gray-200" />
                    <p className="font-medium">{q ? `Tiada hasil untuk "${q}"` : 'Tiada pelanggan dalam segmen ini'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((customer) => {
                const tierName = customer.loyalty_tiers?.name ?? 'Hijau'
                const initials = (customer.full_name ?? '?').charAt(0).toUpperCase()
                const lastOrder = customer.last_order_at
                  ? new Date(customer.last_order_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'
                return (
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    onClick={() => window.location.href = `/admin/customers/${customer.id}`}
                  >
                    {/* Name + email */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${avatarColor(customer.id)}`}>
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 leading-tight">{customer.full_name ?? '—'}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{customer.email ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    {/* Phone */}
                    <td className="px-5 py-3.5 text-gray-600 text-sm">{customer.phone ?? '—'}</td>
                    {/* Segment */}
                    <td className="px-5 py-3.5 text-center">
                      <SegmentBadge segment={customer.segment} />
                    </td>
                    {/* Tier */}
                    <td className="px-5 py-3.5 text-center">
                      <TierBadge name={tierName} />
                    </td>
                    {/* Order count */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-900">{customer.order_count}</span>
                    </td>
                    {/* Spend */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-900">RM{Number(customer.total_spend).toFixed(2)}</span>
                    </td>
                    {/* Last order */}
                    <td className="px-5 py-3.5 text-right text-xs text-gray-400">{lastOrder}</td>
                    {/* Arrow */}
                    <td className="px-4 py-3.5 text-right">
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

