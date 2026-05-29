'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Truck, ExternalLink, Loader2 } from 'lucide-react'
import type { ShippingCarrier, OrderShipment } from '@/types'

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
  const [directUrl, setDirectUrl] = useState(initialShipment?.tracking_url ?? '')
  const [notes, setNotes] = useState(initialShipment?.notes ?? '')

  const activeCarriers = carriers.filter(c => c.is_active)
  const selectedCarrier = carriers.find(c => c.id === (shipment?.carrier_id ?? carrierId))
  const isLalamove = (shipment?.carrier_id ?? carrierId) === 'lalamove'

  async function save() {
    if (!shipment && !carrierId) {
      toast.error('Please select kurier')
      return
    }

    setLoading(true)

    const url = shipment
      ? `/api/admin/shipping/shipments/${shipment.id}`
      : `/api/admin/shipping/shipments`

    const body = shipment
      ? {
          tracking_number: isLalamove ? null : (trackingNumber || null),
          direct_url: isLalamove ? (directUrl || null) : null,
          notes: notes || null,
        }
      : {
          order_id: orderId,
          carrier_id: carrierId,
          tracking_number: isLalamove ? null : (trackingNumber || null),
          direct_url: isLalamove ? (directUrl || null) : null,
          notes: notes || null,
        }

    const res = await fetch(url, {
      method: shipment ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Failed save pengsendan')
    } else {
      toast.success(shipment ? 'Pengsendan diupdate' : 'Pengsendan dibuat')
      setIsEditing(false)
      if (!shipment) {
        const newShipment = await res.json()
        setShipment(newShipment)
      } else {
        setShipment(prev => prev ? {
        ...prev,
        tracking_number: isLalamove ? null : (trackingNumber || null),
        tracking_url: isLalamove ? (directUrl || null) : prev.tracking_url,
        notes: notes || null,
      } : prev)
      }
      router.refresh()
    }
    setLoading(false)
  }

  function startEdit() {
    if (shipment) {
      setCarrierId(shipment.carrier_id)
      setTrackingNumber(shipment.tracking_number ?? '')
      setDirectUrl(shipment.tracking_url ?? '')
      setNotes(shipment.notes ?? '')
    }
    setIsEditing(true)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="h-4 w-4 text-gray-400" />
          Pengsendan
        </h2>
        {shipment && !isEditing && (
          <button
            onClick={startEdit}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors"
          >
            Update
          </button>
        )}
      </div>

      {!isEditing && shipment ? (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Kurier</dt>
            <dd className="font-semibold text-gray-900">{selectedCarrier?.name ?? shipment.carrier_id}</dd>
          </div>
          {shipment.carrier_id === 'lalamove' && shipment.tracking_url ? (
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Link Lalamove</dt>
              <dd>
                <a
                  href={shipment.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 hover:text-orange-700 flex items-center gap-1 text-xs font-semibold"
                >
                  Open Link <ExternalLink className="h-3 w-3" />
                </a>
              </dd>
            </div>
          ) : shipment.tracking_number ? (
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
          ) : null}
          {shipment.notes && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Notes</dt>
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
                <option value="">Select kurier...</option>
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


          {isLalamove ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Link Pengsendan Lalamove</label>
              <input
                value={directUrl}
                onChange={e => setDirectUrl(e.target.value)}
                placeholder="https://link.lalamove.com/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <p className="text-xs text-gray-400 mt-1">Paste share link dari Lalamove Driver App</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">No. Tracking</label>
              <input
                value={trackingNumber}
                onChange={e => setTrackingNumber(e.target.value)}
                placeholder="cth: EE123456789MY"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}


          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nota (selectan)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes..."
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
              {loading ? 'Menyimpan...' : (shipment ? 'Update' : 'Buat Pengsendan')}
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
