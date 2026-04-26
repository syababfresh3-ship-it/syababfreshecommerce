'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Truck, ExternalLink, Loader2 } from 'lucide-react'
import type { ShippingCarrier, OrderShipment, ShipmentStatus } from '@/types'

const SHIPMENT_STATUSES: { value: ShipmentStatus; label: string }[] = [
  { value: 'pending',          label: 'Menunggu Pickup'  },
  { value: 'picked_up',        label: 'Sudah Diambil'    },
  { value: 'in_transit',       label: 'Dalam Transit'    },
  { value: 'out_for_delivery', label: 'Keluar Hantar'    },
  { value: 'delivered',        label: 'Selesai'          },
  { value: 'failed',           label: 'Gagal'            },
]

const STATUS_COLORS: Record<string, string> = {
  pending:          'bg-yellow-50 text-yellow-700 border-yellow-200',
  picked_up:        'bg-blue-50 text-blue-700 border-blue-200',
  in_transit:       'bg-purple-50 text-purple-700 border-purple-200',
  out_for_delivery: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered:        'bg-green-50 text-green-700 border-green-200',
  failed:           'bg-red-50 text-red-600 border-red-200',
}

interface ShipmentPanelProps {
  orderId: string
  initialShipment: OrderShipment | null
  carriers: ShippingCarrier[]
}

export function ShipmentPanel({ orderId, initialShipment, carriers }: ShipmentPanelProps) {
  const [shipment, setShipment] = useState<OrderShipment | null>(initialShipment)
  const [isEditing, setIsEditing] = useState(!initialShipment)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [carrierId, setCarrierId] = useState(initialShipment?.carrier_id ?? '')
  const [trackingNumber, setTrackingNumber] = useState(initialShipment?.tracking_number ?? '')
  const [estimatedDelivery, setEstimatedDelivery] = useState(initialShipment?.estimated_delivery ?? '')
  const [notes, setNotes] = useState(initialShipment?.notes ?? '')
  const [status, setStatus] = useState<ShipmentStatus>(initialShipment?.status ?? 'pending')

  const activeCarriers = carriers.filter(c => c.is_active)
  const selectedCarrier = carriers.find(c => c.id === (shipment?.carrier_id ?? carrierId))

  async function save() {
    if (!shipment && !carrierId) {
      toast.error('Sila pilih kurier')
      return
    }

    setLoading(true)

    const url = shipment
      ? `/api/admin/shipping/shipments/${shipment.id}`
      : `/api/admin/shipping/shipments`

    const body = shipment
      ? { tracking_number: trackingNumber || null, estimated_delivery: estimatedDelivery || null, notes: notes || null, status }
      : { order_id: orderId, carrier_id: carrierId, tracking_number: trackingNumber || null, estimated_delivery: estimatedDelivery || null, notes: notes || null, status }

    const res = await fetch(url, {
      method: shipment ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Gagal simpan penghantaran')
    } else {
      toast.success(shipment ? 'Penghantaran dikemaskini' : 'Penghantaran dibuat')
      setIsEditing(false)
      if (!shipment) {
        const newShipment = await res.json()
        setShipment(newShipment)
      } else {
        setShipment(prev => prev ? { ...prev, tracking_number: trackingNumber || null, estimated_delivery: estimatedDelivery || null, notes: notes || null, status } : prev)
      }
      router.refresh()
    }
    setLoading(false)
  }

  function startEdit() {
    if (shipment) {
      setCarrierId(shipment.carrier_id)
      setTrackingNumber(shipment.tracking_number ?? '')
      setEstimatedDelivery(shipment.estimated_delivery ?? '')
      setNotes(shipment.notes ?? '')
      setStatus(shipment.status)
    }
    setIsEditing(true)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="h-4 w-4 text-gray-400" />
          Penghantaran
        </h2>
        {shipment && !isEditing && (
          <button
            onClick={startEdit}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            Kemaskini
          </button>
        )}
      </div>

      {!isEditing && shipment ? (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Kurier</dt>
            <dd className="font-semibold text-gray-900">{selectedCarrier?.name ?? shipment.carrier_id}</dd>
          </div>
          {shipment.tracking_number && (
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">No. Tracking</dt>
              <dd className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-gray-900">{shipment.tracking_number}</span>
                {shipment.tracking_url && (
                  <a
                    href={shipment.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </dd>
            </div>
          )}
          {shipment.estimated_delivery && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Anggaran Tiba</dt>
              <dd className="text-gray-900">
                {new Date(shipment.estimated_delivery).toLocaleDateString('ms-MY', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </dd>
            </div>
          )}
          <div className="flex justify-between items-center">
            <dt className="text-gray-500">Status</dt>
            <dd>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${STATUS_COLORS[shipment.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {SHIPMENT_STATUSES.find(s => s.value === shipment.status)?.label ?? shipment.status}
              </span>
            </dd>
          </div>
          {shipment.notes && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Nota</dt>
              <dd className="text-gray-700 text-right max-w-[220px] text-xs">{shipment.notes}</dd>
            </div>
          )}
        </dl>
      ) : (
        <div className="space-y-3">
          {!shipment ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kurier *</label>
              <select
                value={carrierId}
                onChange={e => setCarrierId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Pilih kurier...</option>
                {activeCarriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Kurier: <span className="font-semibold text-gray-900">{selectedCarrier?.name ?? shipment.carrier_id}</span>
            </p>
          )}

          {/* Carrier rate reference box */}
          {(() => {
            const cid = shipment?.carrier_id ?? carrierId
            const cfg = selectedCarrier?.config ?? {}
            if (!cid || !selectedCarrier) return null

            type RateRow = { label: string; val: string | undefined }
            let rows: RateRow[] = []
            let color = { bg: 'bg-gray-50', border: 'border-gray-200', title: 'text-gray-600', label: 'text-gray-500', value: 'text-gray-800' }

            if (cid === 'lalamove') {
              rows = [
                { label: 'Lembah Klang',    val: cfg.rate_lembah_klang },
                { label: 'Kawasan Terdekat', val: cfg.rate_kawasan_terdekat },
                { label: 'Lain-lain',        val: cfg.rate_lain },
              ]
              color = { bg: 'bg-orange-50', border: 'border-orange-100', title: 'text-orange-700', label: 'text-orange-600', value: 'text-orange-800' }
            } else if (cid === 'ninja_cold') {
              rows = [
                { label: 'Kadar Flat',        val: cfg.rate_flat },
                { label: 'Surcaj Cold Chain', val: cfg.rate_cold_surcharge },
              ]
              color = { bg: 'bg-blue-50', border: 'border-blue-100', title: 'text-blue-700', label: 'text-blue-600', value: 'text-blue-800' }
            } else if (cid === 'line_clear') {
              rows = [
                { label: 'Kadar Flat', val: cfg.rate_flat },
              ]
              color = { bg: 'bg-green-50', border: 'border-green-100', title: 'text-green-700', label: 'text-green-600', value: 'text-green-800' }
            }

            const filtered = rows.filter(r => r.val)
            if (!filtered.length) return null

            return (
              <div className={`${color.bg} border ${color.border} rounded-lg px-3 py-2.5`}>
                <p className={`text-xs font-semibold ${color.title} mb-1.5`}>
                  Kadar {selectedCarrier.name} (rujukan)
                </p>
                <div className="space-y-1">
                  {filtered.map(r => (
                    <div key={r.label} className="flex justify-between text-xs">
                      <span className={color.label}>{r.label}</span>
                      <span className={`font-bold ${color.value}`}>RM {Number(r.val).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">No. Tracking</label>
            <input
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="cth: EE123456789MY"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status Penghantaran</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ShipmentStatus)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {SHIPMENT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Anggaran Tarikh Tiba</label>
            <input
              type="date"
              value={estimatedDelivery}
              onChange={e => setEstimatedDelivery(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nota (pilihan)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Nota tambahan..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
              {loading ? 'Menyimpan...' : (shipment ? 'Kemaskini' : 'Buat Penghantaran')}
            </button>
            {shipment && (
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
              >
                Batal
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
