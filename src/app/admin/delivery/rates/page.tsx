'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Tag } from 'lucide-react'

interface AreaRate {
  area_name: string
  fee: number
  carrier_id: string | null
  count: number
}

interface Carrier {
  id: string
  name: string
}

export default function DeliveryRatesPage() {
  const [areas, setAreas] = useState<AreaRate[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [defaultFee, setDefaultFee] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editFees, setEditFees] = useState<Record<string, string>>({})
  const [editCarriers, setEditCarriers] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  async function load() {
    const res = await fetch('/api/admin/delivery/rates')
    if (res.ok) {
      const data = await res.json()
      setAreas(data.areas)
      setCarriers(data.carriers)
      setDefaultFee(String(data.default_fee))
      const fees: Record<string, string> = {}
      const cars: Record<string, string> = {}
      for (const a of data.areas) {
        fees[a.area_name] = String(a.fee)
        cars[a.area_name] = a.carrier_id ?? ''
      }
      setEditFees(fees)
      setEditCarriers(cars)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveArea(areaName: string) {
    const fee = parseFloat(editFees[areaName] ?? '0')
    if (isNaN(fee) || fee < 0) { toast.error('Kadar tidak sah'); return }
    setSaving(areaName)
    const res = await fetch('/api/admin/delivery/rates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        area_name: areaName,
        fee,
        carrier_id: editCarriers[areaName] || null,
      }),
    })
    if (!res.ok) toast.error('Gagal simpan')
    else {
      toast.success(`${areaName} dikemas kini`)
      setAreas(prev => prev.map(a =>
        a.area_name === areaName
          ? { ...a, fee, carrier_id: editCarriers[areaName] || null }
          : a
      ))
    }
    setSaving(null)
  }

  async function saveDefault() {
    const fee = parseFloat(defaultFee)
    if (isNaN(fee) || fee < 0) { toast.error('Kadar tidak sah'); return }
    setSaving('__default__')
    const res = await fetch('/api/admin/delivery/rates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_fee: fee }),
    })
    if (!res.ok) toast.error('Gagal simpan')
    else toast.success(`Kadar lalai → RM${fee.toFixed(2)}`)
    setSaving(null)
  }

  const filtered = areas.filter(a =>
    a.area_name.toLowerCase().includes(search.toLowerCase())
  )

  // Summary: fee → postcode count
  const feeGroups: Record<number, number> = {}
  for (const a of areas) feeGroups[a.fee] = (feeGroups[a.fee] ?? 0) + a.count

  // Summary: carrier → area count
  const carrierGroups: Record<string, number> = {}
  for (const a of areas) {
    const key = a.carrier_id ?? 'tiada'
    carrierGroups[key] = (carrierGroups[key] ?? 0) + 1
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/admin/delivery" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kos Penghantaran</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {areas.length} kawasan · set kos & kurier mengikut kawasan
          </p>
        </div>
      </div>

      {/* Summary chips */}
      {!loading && (
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(feeGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([fee, count]) => (
            <span key={fee} className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600">
              RM{Number(fee).toFixed(2)} — {count} poskod
            </span>
          ))}
          {Object.entries(carrierGroups).map(([cid, count]) => {
            const carrier = carriers.find(c => c.id === cid)
            if (!carrier) return null
            return (
              <span key={cid} className="text-xs font-medium px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                {carrier.name} — {count} kawasan
              </span>
            )
          })}
        </div>
      )}

      {/* Default fee */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-gray-400" />
              Kos Lalai
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Dipakai untuk poskod yang tiada dalam senarai kawasan
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-500 font-medium">RM</span>
            <input
              type="number"
              min="0"
              step="0.50"
              value={defaultFee}
              onChange={e => setDefaultFee(e.target.value)}
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              onClick={saveDefault}
              disabled={saving === '__default__'}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving === '__default__' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Simpan
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cari kawasan... (cth: Bangi, Kajang, Shah Alam)"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
      />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">
            {search ? `Tiada kawasan sepadan "${search}"` : 'Tiada kawasan'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kawasan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kurier</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Kos (RM)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(area => {
                const isSaving = saving === area.area_name
                return (
                  <tr key={area.area_name} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {area.area_name}
                      <span className="text-xs text-gray-300 ml-1.5">({area.count})</span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editCarriers[area.area_name] ?? ''}
                        onChange={e => setEditCarriers(prev => ({ ...prev, [area.area_name]: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 w-36"
                      >
                        <option value="">— Tiada —</option>
                        {carriers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs text-gray-400">RM</span>
                        <input
                          type="number"
                          min="0"
                          step="0.50"
                          value={editFees[area.area_name] ?? String(area.fee)}
                          onChange={e => setEditFees(prev => ({ ...prev, [area.area_name]: e.target.value }))}
                          className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => saveArea(area.area_name)}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors ml-auto"
                      >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Simpan
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center leading-relaxed">
        Semua poskod dalam kawasan yang sama dikemas kini serentak.
      </p>
    </div>
  )
}
