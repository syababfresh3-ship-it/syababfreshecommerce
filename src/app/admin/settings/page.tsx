'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Store, Truck, Plus, Trash2, Clock, ChevronDown } from 'lucide-react'
import { ImageUploader } from '@/components/admin/image-uploader'
import Image from 'next/image'

interface DeliverySlot {
  id: string
  day: 'today' | 'tomorrow'
  start: number
  end: number
  label: string
  lead_hours: number
  active: boolean
}

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6) // 6am – 12am

function hourLabel(h: number) {
  if (h === 0 || h === 24) return '12:00 tgh malam'
  if (h === 12) return '12:00 tgh hari'
  return h < 12 ? `${h}:00 pagi` : `${h - 12}:00 ${h < 18 ? 'tgh hari' : 'petang'}`
}

function SlotPreview({ slot }: { slot: DeliverySlot }) {
  const dayLabel = slot.day === 'today' ? 'Hari ini' : 'Esok'
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-fresh-50 text-brand-fresh-700 border border-brand-fresh-200 px-2 py-0.5 rounded-full">
      {dayLabel}, {slot.label}
    </span>
  )
}

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingLogo, setSavingLogo] = useState(false)

  const [freeDeliveryMin, setFreeDeliveryMin] = useState(80)
  const [freeDeliveryEnabled, setFreeDeliveryEnabled] = useState(true)
  const [defaultFee, setDefaultFee] = useState(15)
  const [slots, setSlots] = useState<DeliverySlot[]>([])
  const [savingDelivery, setSavingDelivery] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/settings/logo').then(r => r.json()),
      fetch('/api/admin/settings/delivery').then(r => r.json()),
    ]).then(([logo, delivery]) => {
      setLogoUrl(logo.logo_url ?? null)
      setPendingUrl(logo.logo_url ?? null)
      const min = delivery.free_delivery_min ?? 80
      const enabled = min < 9999
      setFreeDeliveryEnabled(enabled)
      setFreeDeliveryMin(enabled ? min : 80)
      setDefaultFee(delivery.default_delivery_fee ?? 15)
      setSlots(delivery.slots ?? [])
      setLoading(false)
    })
  }, [])

  async function handleSaveLogo() {
    setSavingLogo(true)
    const res = await fetch('/api/admin/settings/logo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: pendingUrl }),
    })
    setSavingLogo(false)
    if (res.ok) { setLogoUrl(pendingUrl); toast.success('Logo dikemaskini') }
    else toast.error('Gagal simpan logo')
  }

  async function handleSaveDelivery() {
    setSavingDelivery(true)
    const res = await fetch('/api/admin/settings/delivery', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ free_delivery_min: freeDeliveryEnabled ? freeDeliveryMin : 99999, default_delivery_fee: defaultFee, slots }),
    })
    setSavingDelivery(false)
    if (res.ok) toast.success('Tetapan penghantaran disimpan')
    else toast.error('Gagal simpan tetapan')
  }

  function updateSlot(id: string, field: keyof DeliverySlot, value: unknown) {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function addSlot(day: 'today' | 'tomorrow') {
    setSlots(prev => [...prev, {
      id: `slot-${Date.now()}`,
      day,
      start: 8, end: 12,
      label: '8am – 12pm',
      lead_hours: day === 'today' ? 2 : 0,
      active: true,
    }])
  }

  function removeSlot(id: string) {
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  const todaySlots = slots.filter(s => s.day === 'today')
  const tomorrowSlots = slots.filter(s => s.day === 'tomorrow')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Tetapan Kedai</h1>
        <p className="text-sm text-gray-500 mt-1">Logo, penghantaran, dan konfigurasi kedai</p>
      </div>

      {/* ── Logo ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
          <div className="w-9 h-9 rounded-xl bg-brand-fresh-100 flex items-center justify-center shrink-0">
            <Store className="h-4 w-4 text-brand-fresh-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Logo Kedai</p>
            <p className="text-xs text-gray-400">Dipaparkan di header website · Saiz cadangan: 720×240px</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Logo Semasa</p>
          <div className="h-16 w-52 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden px-4">
            {logoUrl
              ? <Image src={logoUrl} alt="Logo" width={180} height={48} className="object-contain h-11 w-auto" />
              : <span className="text-xl font-bold text-gradient-brand">SyababFresh</span>}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Upload Logo Baru</p>
          <ImageUploader
            currentUrl={pendingUrl}
            onUpload={(url) => setPendingUrl(url)}
            onRemove={() => setPendingUrl(null)}
            bucket="brand-assets"
            label="Logo (PNG, SVG, JPG · Max 5MB)"
            aspectRatio="aspect-[3/1]"
          />
          {pendingUrl && pendingUrl !== logoUrl && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              ⚠ Klik Simpan untuk paparkan logo baru
            </p>
          )}
        </div>

        <button
          onClick={handleSaveLogo}
          disabled={savingLogo || pendingUrl === logoUrl}
          className="w-full flex items-center justify-center gap-2 bg-brand-fresh-500 hover:bg-brand-fresh-600 text-white font-bold py-3 rounded-2xl disabled:opacity-40 transition-colors"
        >
          {savingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Logo
        </button>
      </div>

      {/* ── Delivery Settings ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-6">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Tetapan Penghantaran</p>
            <p className="text-xs text-gray-400">Had percuma, bayaran, dan slot masa untuk customer</p>
          </div>
        </div>

        {/* Fee cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`border rounded-2xl p-4 transition-colors ${freeDeliveryEnabled ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`text-xs font-bold ${freeDeliveryEnabled ? 'text-green-700' : 'text-gray-500'}`}>🎁 Penghantaran Percuma</p>
              <button
                type="button"
                onClick={() => setFreeDeliveryEnabled(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${freeDeliveryEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${freeDeliveryEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            <p className={`text-[11px] mb-3 ${freeDeliveryEnabled ? 'text-green-600' : 'text-gray-400'}`}>
              {freeDeliveryEnabled ? 'Customer jimat kos bila order mencapai had ini' : 'Penghantaran percuma dimatikan'}
            </p>
            {freeDeliveryEnabled ? (
              <>
                <div className="flex items-center gap-2 bg-white border border-green-200 rounded-xl px-3 py-2">
                  <span className="text-sm font-bold text-gray-500">RM</span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={freeDeliveryMin}
                    onChange={e => setFreeDeliveryMin(Number(e.target.value))}
                    onFocus={e => e.target.select()}
                    className="flex-1 text-2xl font-black text-gray-900 bg-transparent focus:outline-none w-full"
                  />
                </div>
                <p className="text-[10px] text-green-600 mt-2">Order ≥ RM{freeDeliveryMin} = percuma</p>
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 opacity-40">
                <p className="text-2xl font-black text-gray-300">—</p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-700 mb-1">🚗 Bayaran Penghantaran</p>
            <p className="text-[11px] text-blue-600 mb-3">Dikenakan jika tiada kadar zon khusus untuk poskod</p>
            <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-2">
              <span className="text-sm font-bold text-gray-500">RM</span>
              <input
                type="number"
                min={0}
                step={1}
                value={defaultFee}
                onChange={e => setDefaultFee(Number(e.target.value))}
                onFocus={e => e.target.select()}
                className="flex-1 text-2xl font-black text-gray-900 bg-transparent focus:outline-none w-full"
              />
            </div>
            <p className="text-[10px] text-blue-600 mt-2">Bayaran lalai jika zon tidak ditemui</p>
          </div>
        </div>

        {/* Slots */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-bold text-gray-900">Slot Masa Penghantaran</p>
          </div>
          <p className="text-xs text-gray-400 -mt-2">Slot yang aktif akan dipaparkan kepada customer semasa checkout</p>

          {/* Today slots */}
          <SlotGroup
            label="Hari Ini"
            color="orange"
            slots={todaySlots}
            showLead
            onUpdate={updateSlot}
            onRemove={removeSlot}
            onAdd={() => addSlot('today')}
          />

          {/* Tomorrow slots */}
          <SlotGroup
            label="Esok"
            color="blue"
            slots={tomorrowSlots}
            showLead={false}
            onUpdate={updateSlot}
            onRemove={removeSlot}
            onAdd={() => addSlot('tomorrow')}
          />
        </div>

        <button
          onClick={handleSaveDelivery}
          disabled={savingDelivery}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl disabled:opacity-40 transition-colors"
        >
          {savingDelivery ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Tetapan Penghantaran
        </button>
      </div>
    </div>
  )
}

function SlotGroup({
  label, color, slots, showLead, onUpdate, onRemove, onAdd,
}: {
  label: string
  color: 'orange' | 'blue'
  slots: DeliverySlot[]
  showLead: boolean
  onUpdate: (id: string, field: keyof DeliverySlot, value: unknown) => void
  onRemove: (id: string) => void
  onAdd: () => void
}) {
  const colorMap = {
    orange: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', dot: 'bg-orange-400', btn: 'text-orange-600 hover:text-orange-700' },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400',   btn: 'text-blue-600 hover:text-blue-700'   },
  }
  const c = colorMap[color]

  return (
    <div className={`${c.bg} ${c.border} border rounded-2xl p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <p className={`text-xs font-bold ${c.text}`}>{label}</p>
          <span className="text-xs text-gray-400">({slots.filter(s => s.active).length}/{slots.length} aktif)</span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={`flex items-center gap-1 text-xs font-semibold ${c.btn} transition-colors`}
        >
          <Plus className="h-3.5 w-3.5" /> Tambah
        </button>
      </div>

      {slots.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Tiada slot. Klik Tambah untuk buat slot baru.</p>
      ) : (
        <div className="space-y-2">
          {slots.map(slot => (
            <SlotRow
              key={slot.id}
              slot={slot}
              showLead={showLead}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SlotRow({ slot, showLead, onUpdate, onRemove }: {
  slot: DeliverySlot
  showLead: boolean
  onUpdate: (id: string, field: keyof DeliverySlot, value: unknown) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className={`bg-white rounded-xl border transition-all ${slot.active ? 'border-gray-200 shadow-sm' : 'border-gray-100 opacity-50'}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Toggle */}
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={slot.active}
            onChange={e => onUpdate(slot.id, 'active', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-brand-fresh-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
        </label>

        {/* Time range — friendly selects */}
        <div className="flex items-center gap-1.5 shrink-0">
          <HourSelect value={slot.start} onChange={v => onUpdate(slot.id, 'start', v)} />
          <span className="text-gray-300 text-sm">–</span>
          <HourSelect value={slot.end} onChange={v => onUpdate(slot.id, 'end', v)} />
        </div>

        {/* Label */}
        <input
          type="text"
          value={slot.label}
          onChange={e => onUpdate(slot.id, 'label', e.target.value)}
          placeholder="Contoh: 2pm – 6pm"
          className="flex-1 min-w-0 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />

        {/* Lead time (today only) */}
        {showLead && (
          <div className="flex items-center gap-1 shrink-0 bg-orange-50 border border-orange-100 rounded-lg px-2 py-1.5">
            <span className="text-[10px] text-orange-600 font-semibold whitespace-nowrap">Tutup</span>
            <input
              type="number"
              min={0}
              max={12}
              value={slot.lead_hours}
              onChange={e => onUpdate(slot.id, 'lead_hours', Number(e.target.value))}
              className="w-7 text-xs font-bold text-orange-700 bg-transparent focus:outline-none text-center"
            />
            <span className="text-[10px] text-orange-600 font-semibold">j awal</span>
          </div>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={() => onRemove(slot.id)}
          className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Preview what customer sees */}
      {slot.active && (
        <div className="px-3 pb-2.5 flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">Customer nampak:</span>
          <span className="inline-flex items-center text-[10px] font-semibold bg-brand-fresh-50 text-brand-fresh-700 border border-brand-fresh-200 px-2 py-0.5 rounded-full">
            {slot.day === 'today' ? 'Hari ini' : 'Esok'}, {slot.label}
          </span>
        </div>
      )}
    </div>
  )
}

function HourSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  function label(h: number) {
    if (h === 12) return '12pm'
    if (h === 0 || h === 24) return '12am'
    return h < 12 ? `${h}am` : `${h - 12}pm`
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="appearance-none bg-gray-50 border border-gray-200 rounded-lg pl-2.5 pr-6 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer"
      >
        {HOURS.map(h => (
          <option key={h} value={h}>{label(h)}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
    </div>
  )
}
