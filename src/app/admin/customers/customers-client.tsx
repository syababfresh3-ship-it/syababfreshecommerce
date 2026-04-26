'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Users, Star, Crown, Leaf, ChevronRight } from 'lucide-react'
import { CreateUserForm } from './create-user-form'

interface Customer {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  total_points: number
  total_spend: number
  created_at: string
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

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [showForm, setShowForm] = useState(false)
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    if (!q.trim()) return customers
    const lower = q.toLowerCase()
    return customers.filter(c =>
      (c.full_name ?? '').toLowerCase().includes(lower) ||
      (c.email ?? '').toLowerCase().includes(lower) ||
      (c.phone ?? '').includes(lower)
    )
  }, [customers, q])

  return (
    <div className="p-6 max-w-5xl">
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

      {/* Search */}
      <div className="relative mb-4 w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Cari nama, email, telefon..."
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pelanggan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefon</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Mata</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Jumlah Belanja</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Daftar</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Users className="h-10 w-10 text-gray-200" />
                    <p className="font-medium">{q ? `Tiada hasil untuk "${q}"` : 'Tiada pelanggan lagi'}</p>
                    {!q && <p className="text-xs">Tambah pelanggan pertama menggunakan butang di atas</p>}
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((customer) => {
                const tierName = customer.loyalty_tiers?.name ?? 'Hijau'
                const initials = (customer.full_name ?? '?').charAt(0).toUpperCase()
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
                    {/* Tier */}
                    <td className="px-5 py-3.5 text-center">
                      <TierBadge name={tierName} />
                    </td>
                    {/* Points */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-900">{customer.total_points.toLocaleString()}</span>
                      <span className="text-xs text-gray-400 ml-1">mata</span>
                    </td>
                    {/* Spend */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-gray-900">RM{Number(customer.total_spend).toFixed(2)}</span>
                    </td>
                    {/* Date */}
                    <td className="px-5 py-3.5 text-right text-xs text-gray-400">
                      {new Date(customer.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
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
