'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
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

export function CustomersClient({ customers }: { customers: Customer[] }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Pelanggan</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-brand-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-red-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Pelanggan Baru
          </button>
        )}
      </div>

      {showForm && <CreateUserForm onClose={() => setShowForm(false)} />}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefon</th>
              <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tier</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Points</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah Belanja</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Daftar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">Tiada pelanggan lagi</td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{customer.full_name ?? '—'}</div>
                    <div className="text-xs text-gray-400">{customer.email ?? '—'}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{customer.phone ?? '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
                      {customer.loyalty_tiers?.name ?? 'Hijau'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    {customer.total_points.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    RM{Number(customer.total_spend).toFixed(2)}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500 text-xs">
                    {new Date(customer.created_at).toLocaleDateString('ms-MY')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
