'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Package, Zap, Truck, MapPin, Loader2, Settings, Save, Eye, EyeOff,
  ChevronUp, ArrowRight, Scale, Plus, Trash2, Pencil, Check, X,
} from 'lucide-react'
import type { ShippingCarrier } from '@/types'

interface WeightTier {
  id: string
  carrier_id: string
  min_kg: number
  max_kg: number | null
  fee: number
}

const TIER_CARRIERS = [
  { id: 'ninja_cold', label: 'Ninja Van Cold — Luar Lembah Klang' },
]

const CARRIER_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  poslaju:    { icon: Package, color: 'text-red-600',    bg: 'bg-red-100'    },
  ninja_cold: { icon: Zap,     color: 'text-blue-600',   bg: 'bg-blue-100'   },
  line_clear: { icon: Truck,   color: 'text-green-600',  bg: 'bg-green-100'  },
  lalamove:   { icon: MapPin,  color: 'text-orange-600', bg: 'bg-orange-100' },
}

const CARRIER_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  poslaju: [
    { key: 'api_key',         label: 'API Key (EasyParcel / MyDHL)', placeholder: 'Masukkan API Key', secret: true },
    { key: 'api_secret',      label: 'API Secret',                   placeholder: 'Masukkan API Secret', secret: true },
    { key: 'pickup_point_id', label: 'Pickup Point ID',              placeholder: 'cth: PP001' },
  ],
  ninja_cold: [
    { key: 'client_id',          label: 'Client ID',                      placeholder: 'Ninja Van Client ID' },
    { key: 'client_secret',      label: 'Client Secret',                  placeholder: 'Client Secret', secret: true },
    { key: 'rate_flat',          label: 'Kadar Flat (RM)',                placeholder: 'cth: 18.00' },
    { key: 'rate_cold_surcharge',label: 'Surcaj Cold Chain (RM)',         placeholder: 'cth: 5.00' },
  ],
  line_clear: [
    { key: 'api_key',     label: 'API Key',          placeholder: 'Line Clear API Key', secret: true },
    { key: 'branch_code', label: 'Branch Code',      placeholder: 'cth: KUL' },
    { key: 'rate_flat',   label: 'Kadar Flat (RM)',  placeholder: 'cth: 12.00' },
  ],
  lalamove: [
    { key: 'app_key',              label: 'App Key',                    placeholder: 'Lalamove App Key' },
    { key: 'app_secret',           label: 'App Secret',                 placeholder: 'Lalamove App Secret', secret: true },
    { key: 'rate_lembah_klang',    label: 'Kadar Flat — Lembah Klang (RM)', placeholder: 'cth: 15.00' },
    { key: 'rate_kawasan_terdekat',label: 'Kadar Flat — Kawasan Terdekat (RM)', placeholder: 'cth: 25.00' },
    { key: 'rate_lain',            label: 'Kadar Flat — Lain-lain (RM)', placeholder: 'cth: 35.00' },
  ],
}

export default function ShippingPage() {
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  // Weight tiers
  const [tiers, setTiers] = useState<WeightTier[]>([])
  const [tiersLoading, setTiersLoading] = useState(true)
  const [editingTier, setEditingTier] = useState<string | null>(null) // tier id being edited
  const [editValues, setEditValues] = useState<{ min_kg: string; max_kg: string; fee: string }>({ min_kg: '', max_kg: '', fee: '' })
  const [newTier, setNewTier] = useState<{ min_kg: string; max_kg: string; fee: string } | null>(null)
  const [savingTier, setSavingTier] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase
      .from('shipping_carriers')
      .select('*')
      .order('sort_order')
    const list = data ?? []
    setCarriers(list)
    const cfgs: Record<string, Record<string, string>> = {}
    for (const c of list) cfgs[c.id] = (c.config as Record<string, string>) ?? {}
    setConfigs(cfgs)
    setLoading(false)
  }

  useEffect(() => { load(); loadTiers() }, [])

  async function loadTiers() {
    setTiersLoading(true)
    const res = await fetch('/api/admin/shipping/weight-tiers?carrier_id=ninja_cold')
    const json = await res.json()
    setTiers(json.tiers ?? [])
    setTiersLoading(false)
  }

  function startEdit(tier: WeightTier) {
    setEditingTier(tier.id)
    setEditValues({ min_kg: String(tier.min_kg), max_kg: tier.max_kg != null ? String(tier.max_kg) : '', fee: String(tier.fee) })
  }

  async function saveEdit(tierId: string) {
    setSavingTier(true)
    const res = await fetch(`/api/admin/shipping/weight-tiers/${tierId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        min_kg: parseFloat(editValues.min_kg),
        max_kg: editValues.max_kg.trim() === '' ? null : parseFloat(editValues.max_kg),
        fee: parseFloat(editValues.fee),
      }),
    })
    if (!res.ok) { toast.error('Gagal simpan'); setSavingTier(false); return }
    toast.success('Kadar dikemaskini')
    setEditingTier(null)
    await loadTiers()
    setSavingTier(false)
  }

  async function deleteTier(tierId: string) {
    if (!confirm('Padam tier ini?')) return
    const res = await fetch(`/api/admin/shipping/weight-tiers/${tierId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Gagal padam'); return }
    toast.success('Tier dipadam')
    setTiers(prev => prev.filter(t => t.id !== tierId))
  }

  async function addTier() {
    if (!newTier) return
    setSavingTier(true)
    const res = await fetch('/api/admin/shipping/weight-tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrier_id: 'ninja_cold',
        min_kg: parseFloat(newTier.min_kg),
        max_kg: newTier.max_kg.trim() === '' ? null : parseFloat(newTier.max_kg),
        fee: parseFloat(newTier.fee),
      }),
    })
    if (!res.ok) { toast.error('Gagal tambah'); setSavingTier(false); return }
    toast.success('Tier ditambah')
    setNewTier(null)
    await loadTiers()
    setSavingTier(false)
  }

  async function toggle(carrier: ShippingCarrier) {
    setToggling(carrier.id)
    const res = await fetch(`/api/admin/shipping/carriers/${carrier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !carrier.is_active }),
    })
    if (!res.ok) {
      toast.error('Gagal kemaskini')
    } else {
      toast.success(carrier.is_active ? `${carrier.name} dimatikan` : `${carrier.name} diaktifkan`)
      setCarriers(prev => prev.map(c => c.id === carrier.id ? { ...c, is_active: !c.is_active } : c))
    }
    setToggling(null)
  }

  async function saveConfig(carrierId: string) {
    setSaving(carrierId)
    const res = await fetch(`/api/admin/shipping/carriers/${carrierId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: configs[carrierId] ?? {} }),
    })
    if (!res.ok) {
      toast.error('Gagal simpan konfigurasi')
    } else {
      toast.success('Konfigurasi disimpan')
      setExpanded(null)
    }
    setSaving(null)
  }

  function updateConfigField(carrierId: string, key: string, value: string) {
    setConfigs(prev => ({
      ...prev,
      [carrierId]: { ...(prev[carrierId] ?? {}), [key]: value },
    }))
  }

  function toggleSecret(carrierId: string, key: string) {
    const k = `${carrierId}.${key}`
    setShowSecrets(prev => ({ ...prev, [k]: !prev[k] }))
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Penghantaran & Kurier</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {carriers.filter(c => c.is_active).length} daripada {carriers.length} kurier aktif
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/shipping/exports"
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
          >
            Eksport & AWB
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/admin/shipping/shipments"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Semua Penghantaran
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        </div>
      ) : (
        <div className="space-y-3">
          {carriers.map(carrier => {
            const meta = CARRIER_META[carrier.id]
            const Icon = meta?.icon ?? Truck
            const isToggling = toggling === carrier.id
            const isExpanded = expanded === carrier.id
            const isSaving = saving === carrier.id
            const fields = CARRIER_FIELDS[carrier.id] ?? []
            const cfg = configs[carrier.id] ?? {}
            const hasConfig = Object.values(cfg).some(v => v?.trim())

            return (
              <div
                key={carrier.id}
                className={`bg-white rounded-2xl border shadow-sm transition-all ${
                  carrier.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4 p-5">
                  <div className={`p-3 rounded-xl shrink-0 ${meta?.bg ?? 'bg-gray-100'}`}>
                    <Icon className={`h-5 w-5 ${meta?.color ?? 'text-gray-600'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 leading-tight">{carrier.name}</p>
                    {carrier.tracking_url_template && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{carrier.tracking_url_template}</p>
                    )}
                  </div>

                  {hasConfig && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                      API ✓
                    </span>
                  )}

                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shrink-0 ${
                    carrier.is_active
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}>
                    {carrier.is_active ? 'Aktif' : 'Mati'}
                  </span>

                  <button
                    onClick={() => setExpanded(isExpanded ? null : carrier.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors shrink-0"
                    title="Tetapan API"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => toggle(carrier)}
                    disabled={isToggling}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                      carrier.is_active ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 flex items-center justify-center ${
                        carrier.is_active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    >
                      {isToggling && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                    </span>
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Konfigurasi API</p>
                    {fields.length === 0 ? (
                      <p className="text-sm text-gray-400">Tiada konfigurasi API diperlukan untuk kurier ini.</p>
                    ) : (
                      <>
                        {fields.map(field => {
                          const secretKey = `${carrier.id}.${field.key}`
                          const isVisible = showSecrets[secretKey]
                          return (
                            <div key={field.key}>
                              <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                              <div className="relative">
                                <input
                                  type={field.secret && !isVisible ? 'password' : 'text'}
                                  value={cfg[field.key] ?? ''}
                                  onChange={e => updateConfigField(carrier.id, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 pr-9"
                                />
                                {field.secret && (
                                  <button
                                    type="button"
                                    onClick={() => toggleSecret(carrier.id, field.key)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                  >
                                    {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        <button
                          onClick={() => saveConfig(carrier.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 text-center leading-relaxed">
        Konfigurasi API akan digunakan apabila integrasi penghantaran automatik diaktifkan.
      </p>

      {/* ── Weight Tiers ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-4 w-4 text-gray-500" />
          <h2 className="text-base font-bold text-gray-900">Kadar Penghantaran Mengikut Berat</h2>
        </div>

        {TIER_CARRIERS.map(carrier => (
          <div key={carrier.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-bold text-gray-900 text-sm">{carrier.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">Kadar digunakan untuk pesanan luar Lembah Klang</p>
              </div>
              <button
                onClick={() => setNewTier({ min_kg: '', max_kg: '', fee: '' })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />Tambah Tier
              </button>
            </div>

            {tiersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Berat (kg)</th>
                    <th className="text-left px-5 py-3">Kadar (RM)</th>
                    <th className="w-20 px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tiers.filter(t => t.carrier_id === carrier.id).map(tier => (
                    <tr key={tier.id} className={editingTier === tier.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      <td className="px-5 py-3">
                        {editingTier === tier.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number" step="0.01" min="0"
                              value={editValues.min_kg}
                              onChange={e => setEditValues(v => ({ ...v, min_kg: e.target.value }))}
                              className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <span className="text-gray-400">–</span>
                            <input
                              type="number" step="0.01" min="0"
                              value={editValues.max_kg}
                              onChange={e => setEditValues(v => ({ ...v, max_kg: e.target.value }))}
                              placeholder="ke atas"
                              className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                          </div>
                        ) : (
                          <span className="font-mono text-gray-700">
                            {tier.min_kg} – {tier.max_kg != null ? tier.max_kg : 'ke atas'} kg
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {editingTier === tier.id ? (
                          <input
                            type="number" step="0.01" min="0"
                            value={editValues.fee}
                            onChange={e => setEditValues(v => ({ ...v, fee: e.target.value }))}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        ) : (
                          <span className="font-semibold text-gray-800">RM {Number(tier.fee).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {editingTier === tier.id ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => saveEdit(tier.id)}
                              disabled={savingTier}
                              className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                            >
                              {savingTier ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => setEditingTier(null)}
                              className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button onClick={() => startEdit(tier)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteTier(tier.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Add new tier row */}
                  {newTier && (
                    <tr className="bg-green-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number" step="0.01" min="0"
                            value={newTier.min_kg}
                            onChange={e => setNewTier(v => v ? { ...v, min_kg: e.target.value } : v)}
                            placeholder="min"
                            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                          />
                          <span className="text-gray-400">–</span>
                          <input
                            type="number" step="0.01" min="0"
                            value={newTier.max_kg}
                            onChange={e => setNewTier(v => v ? { ...v, max_kg: e.target.value } : v)}
                            placeholder="max (kosong = ke atas)"
                            className="w-36 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                          />
                          <span className="text-xs text-gray-400">kg</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">RM</span>
                          <input
                            type="number" step="0.01" min="0"
                            value={newTier.fee}
                            onChange={e => setNewTier(v => v ? { ...v, fee: e.target.value } : v)}
                            placeholder="0.00"
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5">
                          <button
                            onClick={addTier}
                            disabled={savingTier || !newTier.min_kg || !newTier.fee}
                            className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 transition-colors"
                          >
                            {savingTier ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button onClick={() => setNewTier(null)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {tiers.filter(t => t.carrier_id === carrier.id).length === 0 && !newTier && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-400">
                        Tiada tier. Klik "Tambah Tier" untuk mulakan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
