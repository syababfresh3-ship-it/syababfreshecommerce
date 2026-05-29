'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Truck, ExternalLink, Loader2 } from 'lucide-react'

interface Carrier { id: string; name: string; is_active: boolean }
interface Props {
  orderId: string
  courierId: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  shipmentNotes: string | null
  carriers: Carrier[]
}

export function LpShipmentPanel({ orderId, courierId, trackingNumber, trackingUrl, shipmentNotes, carriers }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(!courierId)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    courier_id: courierId ?? '',
    tracking_number: trackingNumber ?? '',
    tracking_url: trackingUrl ?? '',
    shipment_notes: shipmentNotes ?? '',
  })

  const activeCarriers = carriers.filter(c => c.is_active)
  const selectedCarrier = carriers.find(c => c.id === (courierId ?? form.courier_id))
  const isLalamove = (courierId ?? form.courier_id) === 'lalamove'

  async function save() {
    if (!form.courier_id) { toast.error('Please select a courier'); return }
    setLoading(true)
    const res = await fetch('/api/admin/landing-pages/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: orderId,
        courier_id: form.courier_id,
        tracking_number: isLalamove ? null : (form.tracking_number || null),
        tracking_url: isLalamove ? (form.tracking_url || null) : null,
        shipment_notes: form.shipment_notes || null,
      }),
    })
    if (!res.ok) toast.error('Failed to save shipment')
    else { toast.success('Shipment saved'); setEditing(false); router.refresh() }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Truck className="h-4 w-4 text-gray-400" /> Shipment
        </h2>
        {courierId && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg">Update</button>
        )}
      </div>

      {!editing && courierId ? (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Courier</dt>
            <dd className="font-semibold text-gray-900">{selectedCarrier?.name ?? courierId}</dd>
          </div>
          {courierId === 'lalamove' && trackingUrl ? (
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Lalamove Link</dt>
              <dd><a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-700 flex items-center gap-1 text-xs font-semibold">Open Link <ExternalLink className="h-3 w-3" /></a></dd>
            </div>
          ) : trackingNumber ? (
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Tracking No.</dt>
              <dd className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-gray-900">{trackingNumber}</span>
              </dd>
            </div>
          ) : null}
          {shipmentNotes && <div className="flex justify-between"><dt className="text-gray-500">Notes</dt><dd className="text-gray-700 text-xs text-right max-w-[220px]">{shipmentNotes}</dd></div>}
        </dl>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Courier *</label>
            <select value={form.courier_id} onChange={e => setForm(f => ({ ...f, courier_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">Select courier...</option>
              {activeCarriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {isLalamove ? (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lalamove Delivery Link</label>
              <input value={form.tracking_url} onChange={e => setForm(f => ({ ...f, tracking_url: e.target.value }))}
                placeholder="https://link.lalamove.com/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <p className="text-xs text-gray-400 mt-1">Paste share link from Lalamove Driver App</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tracking No.</label>
              <input value={form.tracking_number} onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))}
                placeholder="e.g. EE123456789MY"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
            <textarea value={form.shipment_notes} onChange={e => setForm(f => ({ ...f, shipment_notes: e.target.value }))}
              placeholder="Additional notes..." rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
              {loading ? 'Saving...' : (courierId ? 'Update Shipment' : 'Create Shipment')}
            </button>
            {courierId && <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>}
          </div>
        </div>
      )}
    </div>
  )
}
