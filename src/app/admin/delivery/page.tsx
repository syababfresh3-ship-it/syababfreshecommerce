'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, MapPin, Search, X, Upload, Eye, EyeOff, Loader2, Tag } from 'lucide-react'
import Link from 'next/link'

interface Zone {
  postcode: string
  area_name: string
  city: string
  state: string
  frequency: string
  is_active: boolean
}

const malaysiaStates = [
  'Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya', 'W.P. Labuan',
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Terengganu',
]

const FREQ_STYLES: Record<string, string> = {
  'Daily':          'bg-green-50 text-green-700 border-green-200',
  'Mon, Wed, Fri':  'bg-blue-50 text-blue-700 border-blue-200',
  'Tue, Thu, Sat':  'bg-purple-50 text-purple-700 border-purple-200',
  'Saturday only':  'bg-orange-50 text-orange-700 border-orange-200',
}

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ postcode: '', area_name: '', city: '', state: 'Selangor', frequency: 'Daily' })
  const [bulkInput, setBulkInput] = useState('')
  const [showBulk, setShowBulk] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/delivery')
    if (res.ok) setZones(await res.json())
  }

  useEffect(() => { load() }, [])

  const filtered = zones.filter(z =>
    z.postcode.includes(search) ||
    z.area_name.toLowerCase().includes(search.toLowerCase()) ||
    z.city.toLowerCase().includes(search.toLowerCase())
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{5}$/.test(form.postcode)) { toast.error('Poskod mesti 5 digit'); return }
    setLoading(true)
    const res = await fetch('/api/admin/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, is_active: true }),
    })
    if (!res.ok) toast.error('Gagal tambah kawasan')
    else {
      toast.success('Kawasan ditambah')
      setForm({ postcode: '', area_name: '', city: '', state: 'Selangor', frequency: 'Daily' })
      setShowForm(false)
      load()
    }
    setLoading(false)
  }

  async function toggleActive(z: Zone) {
    await fetch(`/api/admin/delivery/${z.postcode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !z.is_active }),
    })
    load()
  }

  async function handleDelete(postcode: string) {
    if (!confirm(`Padam poskod ${postcode}?`)) return
    await fetch(`/api/admin/delivery/${postcode}`, { method: 'DELETE' })
    toast.success('Kawasan dipadam')
    load()
  }

  async function handleBulkImport(e: React.FormEvent) {
    e.preventDefault()
    const lines = bulkInput.trim().split('\n').filter(Boolean)
    const rows: Partial<Zone>[] = []
    const errors: string[] = []

    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim())
      if (parts.length < 3) { errors.push(`Baris tidak lengkap: ${line}`); continue }
      const [postcode, area_name, city, state = 'Selangor'] = parts
      if (!/^\d{5}$/.test(postcode)) { errors.push(`Poskod tidak sah: ${postcode}`); continue }
      rows.push({ postcode, area_name, city, state, is_active: true })
    }

    if (errors.length) { toast.error(`${errors.length} baris ada ralat`); return }
    if (!rows.length) { toast.error('Tiada data untuk import'); return }

    setLoading(true)
    const res = await fetch('/api/admin/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk: true, rows }),
    })
    if (!res.ok) toast.error('Gagal import')
    else { toast.success(`${rows.length} kawasan diimport`); setBulkInput(''); setShowBulk(false); load() }
    setLoading(false)
  }

  const activeCount = zones.filter(z => z.is_active).length

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kawasan Penghantaran</h1>
          <p className="text-sm text-gray-400 mt-0.5">{activeCount} aktif · {zones.length} jumlah poskod</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/delivery/rates"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Tag className="h-3.5 w-3.5" /> Kadar Penghantaran
          </Link>
          <button
            onClick={() => { setShowBulk(!showBulk); setShowForm(false) }}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </button>
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setShowBulk(false) }}
              className="flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" /> Tambah Poskod
            </button>
          )}
        </div>
      </div>

      {/* Bulk import */}
      {showBulk && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 p-1.5 rounded-lg"><Upload className="h-4 w-4 text-blue-600" /></div>
              <h2 className="font-bold text-gray-900">Import CSV</h2>
            </div>
            <button onClick={() => setShowBulk(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-xl px-3 py-2 font-mono">
            Format: <span className="text-gray-700">poskod, nama_kawasan, bandar, negeri</span>
          </p>
          <form onSubmit={handleBulkImport} className="space-y-3">
            <textarea
              value={bulkInput}
              onChange={e => setBulkInput(e.target.value)}
              rows={6}
              placeholder={"47500, Subang Jaya, Subang Jaya, Selangor\n46000, Petaling Jaya, Petaling Jaya, Selangor"}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowBulk(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Import
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-red-100 p-1.5 rounded-lg"><MapPin className="h-4 w-4 text-red-600" /></div>
              <h2 className="font-bold text-gray-900">Kawasan Baru</h2>
            </div>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Poskod *</label>
                <input
                  value={form.postcode}
                  onChange={e => setForm(p => ({ ...p, postcode: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                  maxLength={5} required placeholder="47500"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nama Kawasan *</label>
                <input
                  value={form.area_name}
                  onChange={e => setForm(p => ({ ...p, area_name: e.target.value }))}
                  required placeholder="Subang Jaya"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Bandar *</label>
                <input
                  value={form.city}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                  required placeholder="Subang Jaya"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Negeri *</label>
                <select
                  value={form.state}
                  onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  {malaysiaStates.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Frekuensi Penghantaran</label>
              <select
                value={form.frequency}
                onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="Daily">Daily</option>
                <option value="Mon, Wed, Fri">Mon, Wed, Fri</option>
                <option value="Tue, Thu, Sat">Tue, Thu, Sat</option>
                <option value="Saturday only">Saturday only</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Batal
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Simpan Kawasan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari poskod atau kawasan..."
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Poskod</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kawasan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bandar</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Negeri</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Frekuensi</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <MapPin className="h-8 w-8 text-gray-200" />
                    <p className="font-medium">{search ? `Tiada hasil untuk "${search}"` : 'Tiada kawasan penghantaran'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(z => (
                <tr key={z.postcode} className={`hover:bg-gray-50/80 transition-colors ${!z.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-mono font-bold text-gray-900 text-sm">{z.postcode}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{z.area_name}</td>
                  <td className="px-5 py-3 text-gray-600">{z.city}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{z.state}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-lg border ${FREQ_STYLES[z.frequency] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {z.frequency ?? 'Daily'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button
                      onClick={() => toggleActive(z)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        z.is_active
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {z.is_active ? <><Eye className="h-3 w-3" /> Aktif</> : <><EyeOff className="h-3 w-3" /> Sembunyi</>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(z.postcode)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
