'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, MapPin, Search, X, Upload, Eye, EyeOff, Loader2, Tag, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Zone {
  postcode: string
  area_name: string
  city: string
  state: string
  frequency: string
  is_active: boolean
  courier_override: 'pos' | 'lalamove' | null
}

const malaysiaStates = [
  'Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya', 'W.P. Labuan',
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Terengganu',
]

const PAGE_SIZE = 50

const FREQ_STYLES: Record<string, string> = {
  'Harian':            'bg-green-50 text-green-700 border-green-200',
  '1-3 Hari Bekerja':  'bg-blue-50 text-blue-700 border-blue-200',
  // legacy values
  'Daily':             'bg-green-50 text-green-700 border-green-200',
  'Mon, Wed, Fri':     'bg-blue-50 text-blue-700 border-blue-200',
  'Tue, Thu, Sat':     'bg-blue-50 text-blue-700 border-blue-200',
  'Saturday only':     'bg-orange-50 text-orange-700 border-orange-200',
}

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterFreq, setFilterFreq] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ postcode: '', area_name: '', city: '', state: 'Selangor', frequency: 'Harian' })
  const [bulkInput, setBulkInput] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [page, setPage] = useState(1)

  async function load() {
    const res = await fetch('/api/admin/delivery')
    if (res.ok) setZones(await res.json())
  }

  useEffect(() => { load() }, [])

  const filtered = zones.filter(z => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      z.postcode.includes(search) ||
      z.area_name.toLowerCase().includes(q) ||
      z.city.toLowerCase().includes(q) ||
      z.state.toLowerCase().includes(q)
    const matchState = !filterState || z.state === filterState
    const matchFreq = !filterFreq || z.frequency === filterFreq
    return matchSearch && matchState && matchFreq
  })

  // Pagination — reset ke page 1 bila penapis berubah, clamp jika luar julat
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, filterState, filterFreq])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{5}$/.test(form.postcode)) { toast.error('Postcode mesti 5 digit'); return }
    setLoading(true)
    const res = await fetch('/api/admin/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, is_active: true }),
    })
    if (!res.ok) toast.error('Failed tambah kawasan')
    else {
      toast.success('Kawasan ditambah')
      setForm({ postcode: '', area_name: '', city: '', state: 'Selangor', frequency: 'Harian' })
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

  // Override kurier per-poskod (auto = ikut julat poskod). 'pos' = paksa Pos (Lalamove
  // tak sampai); 'lalamove' = paksa Lalamove (Pos tak sampai).
  async function setOverride(postcode: string, value: '' | 'pos' | 'lalamove') {
    await fetch(`/api/admin/delivery/${postcode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courier_override: value || null }),
    })
    setZones(prev => prev.map(z => z.postcode === postcode ? { ...z, courier_override: value || null } : z))
    toast.success(value ? `${postcode} → ${value === 'pos' ? 'Pos sahaja' : 'Lalamove sahaja'}` : `${postcode} → auto`)
  }

  async function handleDelete(postcode: string) {
    if (!confirm(`Delete postcode ${postcode}?`)) return
    await fetch(`/api/admin/delivery/${postcode}`, { method: 'DELETE' })
    toast.success('Kawasan didelete')
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
      if (!/^\d{5}$/.test(postcode)) { errors.push(`Postcode tidak sah: ${postcode}`); continue }
      rows.push({ postcode, area_name, city, state, is_active: true })
    }

    if (errors.length) { toast.error(`${errors.length} baris ada ralat`); return }
    if (!rows.length) { toast.error('No data untuk import'); return }

    setLoading(true)
    const res = await fetch('/api/admin/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulk: true, rows }),
    })
    if (!res.ok) toast.error('Failed import')
    else { toast.success(`${rows.length} kawasan diimport`); setBulkInput(''); setShowBulk(false); load() }
    setLoading(false)
  }

  const activeCount = zones.filter(z => z.is_active).length

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kawasan Pengsendan</h1>
          <p className="text-sm text-gray-400 mt-0.5">{activeCount} active · {zones.length} jumlah postcode</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/delivery/rates"
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Tag className="h-3.5 w-3.5" /> Kadar Pengsendan
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
              <Plus className="h-4 w-4" /> Add Postcode
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
            Format: <span className="text-gray-700">postcode, nama_kawasan, bandar, negeri</span>
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
              <h2 className="font-bold text-gray-900">Kawasan New</h2>
            </div>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Postcode *</label>
                <input
                  value={form.postcode}
                  onChange={e => setForm(p => ({ ...p, postcode: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                  maxLength={5} required placeholder="47500"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Name Kawasan *</label>
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
                  onChange={e => {
                    const klangValley = ['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya']
                    setForm(p => ({
                      ...p,
                      state: e.target.value,
                      frequency: klangValley.includes(e.target.value) ? 'Harian' : '1-3 Hari Bekerja'
                    }))
                  }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  {malaysiaStates.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Frekuensi Pengsendan</label>
              <select
                value={form.frequency}
                onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="Harian">Harian (Lembah Klang)</option>
                <option value="1-3 Hari Bekerja">1-3 Hari Bekerja (Luar KL)</option>
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
                Save Kawasan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search postcode, kawasan, negeri..."
            className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          className="py-2.5 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm text-gray-700"
        >
          <option value="">All Negeri</option>
          {malaysiaStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filterFreq}
          onChange={e => setFilterFreq(e.target.value)}
          className="py-2.5 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white shadow-sm text-gray-700"
        >
          <option value="">All Frekuensi</option>
          <option value="Harian">Harian (Lembah Klang)</option>
          <option value="1-3 Hari Bekerja">1-3 Hari Bekerja (Luar KL)</option>
        </select>

        {(search || filterState || filterFreq) && (
          <button onClick={() => { setSearch(''); setFilterState(''); setFilterFreq('') }}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 font-medium">
            Reset
          </button>
        )}

        <span className="text-xs text-gray-400 ml-1">{filtered.length} kawasan</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Postcode</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kawasan</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bandar</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Negeri</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Frekuensi</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kurier</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <MapPin className="h-8 w-8 text-gray-200" />
                    <p className="font-medium">{search ? `No hasil untuk "${search}"` : 'No kawasan pengsendan'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map(z => (
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
                  <td className="px-5 py-3">
                    <select
                      value={z.courier_override ?? ''}
                      onChange={e => setOverride(z.postcode, e.target.value as '' | 'pos' | 'lalamove')}
                      title="Override kurier (auto = ikut julat poskod)"
                      className={`text-xs font-semibold px-2 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-300 ${
                        z.courier_override === 'pos' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : z.courier_override === 'lalamove' ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'bg-white text-gray-500 border-gray-200'
                      }`}
                    >
                      <option value="">Auto</option>
                      <option value="pos">Pos sahaja</option>
                      <option value="lalamove">Lalamove sahaja</option>
                    </select>
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
                      {z.is_active ? <><Eye className="h-3 w-3" /> Active</> : <><EyeOff className="h-3 w-3" /> Sembunyi</>}
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

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-gray-500">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} drpd {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" /> Sebelum
            </button>
            <span className="text-gray-500">Page {page}/{pageCount}</span>
            <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page >= pageCount}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              Seterus <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
