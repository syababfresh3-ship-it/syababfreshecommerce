'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Truck, ChevronDown, ChevronRight, Copy, CheckCheck, RefreshCw,
  Phone, MapPin, Clock, Package, AlertCircle, User, StickyNote,
  Printer, Filter, Calendar, Save, CheckCircle2, Loader2, Trash2,
  Send, ExternalLink, X, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { KV_ZONES, getZone, extractPostcode, ZONE_COLORS, type ZoneConfig } from './zone-config'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LalamoveOrder {
  id: string
  order_number: string
  status: string
  payment_status: string
  total: number
  delivery_address: string | null
  delivery_slot: string | null
  notes: string | null
  created_at: string
  full_name: string | null
  phone: string | null
  postcode: string | null
  city: string | null
  recipient_name: string | null
  recipient_phone: string | null
  items: { product_name: string; quantity: number; variant_name: string | null }[]
  source: 'order' | 'lp'
}

export type BatchStatus = 'draft' | 'ready' | 'booked' | 'delivered'

interface ZoneGroup {
  zone: ZoneConfig
  orders: LalamoveOrder[]
  status: BatchStatus
  savedId?: string   // delivery_batches.id if saved to DB
}

interface SavedBatch {
  id: string
  zone_id: string
  zone_name: string
  status: BatchStatus
  batch_code: string
  stop_count: number
  delivery_batch_orders: { order_id: string; stop_sequence: number }[]
}

const STATUS_LABELS: Record<BatchStatus, { label: string; color: string }> = {
  draft:     { label: 'Draft',              color: 'bg-gray-100 text-gray-600' },
  ready:     { label: 'Ready for Lalamove', color: 'bg-yellow-100 text-yellow-700' },
  booked:    { label: 'Booked',             color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Selesai',            color: 'bg-green-100 text-green-700' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getItemsSummary(items: LalamoveOrder['items']): string {
  return items
    .map((i) => `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} ×${i.quantity}`)
    .join(', ')
}

function getPostcode(order: LalamoveOrder): string | null {
  return order.postcode ?? extractPostcode(order.delivery_address)
}

function formatCopyList(orders: LalamoveOrder[]): string {
  return orders
    .map((o, idx) => {
      const name = o.full_name ?? o.recipient_name ?? '—'
      const phone = o.phone ?? o.recipient_phone ?? '—'
      const address = o.delivery_address ?? '—'
      const items = getItemsSummary(o.items)
      return `${idx + 1}. ${name} – ${phone}\nAddress: ${address}\nItem: ${items}\nPayment: ${o.payment_status === 'paid' ? '✓ Dah bayar' : '⚡ COD'}${o.notes ? `\nNota: ${o.notes}` : ''}`
    })
    .join('\n\n')
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

function OrderCard({
  order, zones, currentZoneId, onMove, selected, onToggleSelect,
}: {
  order: LalamoveOrder
  zones: ZoneGroup[]
  currentZoneId: string
  onMove: (orderId: string, fromZoneId: string, toZoneId: string) => void
  selected: boolean
  onToggleSelect: (orderId: string) => void
}) {
  const postcode = getPostcode(order)
  const isPaid = order.payment_status === 'paid'

  return (
    <div className={`bg-white rounded-xl border p-3.5 space-y-2.5 shadow-sm transition-colors ${selected ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(order.id)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-orange-500 focus:ring-orange-400 cursor-pointer"
          />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-gray-500">{order.order_number}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
              {isPaid ? '✓ Bayar' : '⚡ COD'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              RM{Number(order.total).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <User className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-800 truncate">
              {order.full_name ?? order.recipient_name ?? '—'}
            </span>
          </div>
        </div>
        </div>
        <select
          value={currentZoneId}
          onChange={(e) => onMove(order.id, currentZoneId, e.target.value)}
          className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white shrink-0 focus:outline-none focus:ring-1 focus:ring-brand-fresh-400"
        >
          {zones.map((z) => (
            <option key={z.zone.id} value={z.zone.id}>{z.zone.emoji} {z.zone.name}</option>
          ))}
        </select>
      </div>

      {(order.phone ?? order.recipient_phone) && (
        <a href={`tel:${order.phone ?? order.recipient_phone}`} className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
          <Phone className="h-3 w-3" />
          {order.phone ?? order.recipient_phone}
        </a>
      )}

      {order.delivery_address && (
        <div className="flex items-start gap-1.5">
          <MapPin className="h-3 w-3 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{order.delivery_address}</p>
        </div>
      )}

      {postcode && (
        <span className="inline-block text-[10px] font-mono font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
          {postcode}
        </span>
      )}

      {order.items.length > 0 && (
        <div className="flex items-start gap-1.5">
          <Package className="h-3 w-3 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">{getItemsSummary(order.items)}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        {order.delivery_slot && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 rounded-full px-2 py-0.5">
            <Clock className="h-2.5 w-2.5" />{order.delivery_slot}
          </div>
        )}
        {order.notes && (
          <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">
            <StickyNote className="h-2.5 w-2.5" />{order.notes}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LalamoveBookButton ───────────────────────────────────────────────────────
// Auto-book: quote (papar harga + alamat bermasalah) → sahkan → place order.

interface QuoteResp {
  quotationId: string
  senderStopId: string
  total: string
  currency: string
  recipients: { stopId: string; orderId: string; name: string; phone: string; remarks: string; address: string }[]
  flagged: { id: string; address: string; reason: string }[]
}
interface BookResp { orderId: string; shareLink: string; status: string; total: string; currency: string }

// Tukar LalamoveOrder[] → payload API (id, uuid, source, nama, telefon, alamat, remarks)
function ordersToPayload(orders: LalamoveOrder[]) {
  return orders.map((o) => ({
    id: o.order_number,
    uuid: o.id,              // id sebenar — untuk rekod shipment di server
    source: o.source,
    name: o.full_name ?? o.recipient_name ?? '',
    phone: o.phone ?? o.recipient_phone ?? '',
    address: o.delivery_address ?? '',
    remarks: [
      o.notes,
      o.payment_status !== 'paid' ? `COD: kutip RM${Number(o.total).toFixed(2)}` : null,
    ].filter(Boolean).join(' · '),
  }))
}

// Modal terkawal: auto-quote bila dibuka, papar harga + penerima, sahkan → book.
// Terima senarai order arbitrari (satu zon, ATAU order terpilih merentas zon).
function LalamoveBookModal({ orders, title, onClose, onBooked }: {
  orders: LalamoveOrder[]
  title: string
  onClose: () => void
  onBooked: (bookedOrderIds: string[]) => void
}) {
  const [state, setState] = useState<'quoting' | 'confirm' | 'booking' | 'done'>('quoting')
  const [quote, setQuote] = useState<QuoteResp | null>(null)
  const [result, setResult] = useState<BookResp | null>(null)

  // Auto-quote sekali masa modal dibuka
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/lalamove/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: ordersToPayload(orders) }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) { toast.error(data.error ?? 'Quote gagal'); onClose(); return }
        setQuote(data); setState('confirm')
      } catch { if (!cancelled) { toast.error('Ralat rangkaian'); onClose() } }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleBook() {
    setState('booking')
    try {
      // Hantar semula orders — /book quote SEGAR + place serentak (elak schedule tamat tempoh)
      const res = await fetch('/api/lalamove/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: ordersToPayload(orders) }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Book gagal'); setState('confirm'); return }
      setResult(data); setState('done')
      onBooked(orders.map((o) => o.id))
      toast.success(`Order Lalamove dibuat! ${data.currency} ${data.total}`)
    } catch { toast.error('Ralat rangkaian'); setState('confirm') }
  }

  return (
    <>
      {(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" /> {title}
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {state === 'quoting' ? (
                <div className="py-10 text-center text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                  <p className="text-sm">Mengira harga & semak alamat…</p>
                </div>
              ) : !quote ? null : state === 'done' && result ? (
                <div className="space-y-3 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                  <p className="font-bold text-gray-900">Order Lalamove berjaya!</p>
                  <p className="text-2xl font-extrabold text-gray-900">{result.currency} {result.total}</p>
                  <p className="text-xs text-gray-400">Status: {result.status} · {quote.recipients.length} penghantaran</p>
                  <a href={result.shareLink} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700">
                    <ExternalLink className="h-4 w-4" /> Buka tracking Lalamove
                  </a>
                  <button onClick={close} className="block w-full text-sm text-gray-500 py-2">Tutup</button>
                </div>
              ) : (
                <>
                  {/* Harga */}
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">Anggaran harga</p>
                    <p className="text-3xl font-extrabold text-gray-900 mt-1">{quote.currency} {quote.total}</p>
                    <p className="text-xs text-gray-400 mt-1">{quote.recipients.length} penghantaran · Motosikal</p>
                  </div>

                  {/* Senarai penerima */}
                  <div className="space-y-2">
                    {quote.recipients.map((r, i) => (
                      <div key={r.stopId} className="flex items-start gap-2 text-xs">
                        <span className="font-bold text-gray-400 shrink-0">{i + 1}.</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">{r.name} · {r.phone}</p>
                          <p className="text-gray-500 truncate">{r.address}</p>
                          {r.remarks && <p className="text-orange-600">{r.remarks}</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Alamat bermasalah */}
                  {quote.flagged.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1.5">
                      <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> {quote.flagged.length} alamat DITINGGALKAN (tak boleh book)
                      </p>
                      {quote.flagged.map((f, i) => (
                        <p key={i} className="text-[11px] text-red-500">⚠️ {f.id || f.address} — {f.reason}</p>
                      ))}
                      <p className="text-[10px] text-red-400">Hantar order ini secara manual / betulkan alamat dahulu.</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={close} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">
                      Batal
                    </button>
                    <button onClick={handleBook} disabled={state === 'booking'}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50">
                      {state === 'booking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {state === 'booking' ? 'Membook...' : 'Sahkan & Book'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── ZoneGroupCard ────────────────────────────────────────────────────────────

function ZoneGroupCard({
  group, zones, onMove, onStatusChange, selectedIds, onToggleSelect, onToggleZone, onBook,
}: {
  group: ZoneGroup
  zones: ZoneGroup[]
  onMove: (orderId: string, fromZoneId: string, toZoneId: string) => void
  onStatusChange: (zoneId: string, status: BatchStatus) => void
  selectedIds: Set<string>
  onToggleSelect: (orderId: string) => void
  onToggleZone: (orderIds: string[], selectAll: boolean) => void
  onBook: (orders: LalamoveOrder[], title: string, onDone: () => void) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)
  const allSelected = group.orders.length > 0 && group.orders.every((o) => selectedIds.has(o.id))
  const colorClass = ZONE_COLORS[group.zone.color] ?? ZONE_COLORS.gray
  const statusInfo = STATUS_LABELS[group.status]

  function handleCopy() {
    const text = formatCopyList(group.orders)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success(`Disalin! ${group.orders.length} order dari ${group.zone.name}`)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    const html = `<html><head><title>${group.zone.name}</title>
      <style>body{font-family:sans-serif;padding:20px}h2{margin-bottom:16px}.order{border:1px solid #ddd;padding:12px;margin-bottom:12px;border-radius:8px}p{margin:3px 0;font-size:13px}</style>
      </head><body>
      <h2>${group.zone.emoji} ${group.zone.name} — ${group.orders.length} order</h2>
      ${group.orders.map((o, idx) => `
        <div class="order">
          <p><strong>${idx + 1}. ${o.full_name ?? '—'}</strong> — ${o.phone ?? '—'}</p>
          <p>${o.order_number} | RM${Number(o.total).toFixed(2)} | ${o.payment_status === 'paid' ? '✓ Bayar' : 'COD'}</p>
          <p>📍 ${o.delivery_address ?? '—'}</p>
          <p>📦 ${getItemsSummary(o.items)}</p>
          ${o.notes ? `<p>📝 ${o.notes}</p>` : ''}
        </div>`).join('')}
      </body></html>`
    win.document.write(html)
    win.document.close()
    win.print()
  }

  if (group.orders.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
          <input
            type="checkbox"
            checked={allSelected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleZone(group.orders.map((o) => o.id), !allSelected)}
            title="Pilih semua dalam zon"
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-orange-500 focus:ring-orange-400 cursor-pointer"
          />
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${colorClass}`}>
            {group.zone.emoji} {group.zone.name}
          </span>
          <span className="text-sm font-bold text-gray-900">{group.orders.length} order</span>
          {group.savedId && (
            <span className="text-[10px] text-brand-fresh-600 font-semibold flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" /> Tersave
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <select
            value={group.status}
            onChange={(e) => onStatusChange(group.zone.id, e.target.value as BatchStatus)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border-0 focus:outline-none focus:ring-1 focus:ring-gray-300 ${statusInfo.color}`}
          >
            {(Object.entries(STATUS_LABELS) as [BatchStatus, { label: string; color: string }][]).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-[11px] font-bold rounded-xl hover:bg-gray-700 transition-colors"
          >
            {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Disalin!' : 'Copy'}
          </button>
          <button
            onClick={() => onBook(group.orders, `${group.zone.emoji} ${group.zone.name}`, () => onStatusChange(group.zone.id, 'booked'))}
            disabled={group.status === 'booked'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-[11px] font-bold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors"
            title="Quote & hantar zon ini ke Lalamove"
          >
            <Send className="h-3.5 w-3.5" /> Lalamove
          </button>
          <button onClick={handlePrint} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors" title="Print">
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-gray-100 pt-3">
          {group.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              zones={zones}
              currentZoneId={group.zone.id}
              onMove={onMove}
              selected={selectedIds.has(order.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GroupingClient({ orders }: { orders: LalamoveOrder[] }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [cutoff, setCutoff] = useState('15:00')
  const [statusFilter, setStatusFilter] = useState<string[]>(['confirmed', 'preparing'])
  const [groups, setGroups] = useState<ZoneGroup[] | null>(null)
  const [generated, setGenerated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(false)

  // ── Pilihan order (tick) untuk gabung jadi satu booking Lalamove ──────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [booking, setBooking] = useState<{ orders: LalamoveOrder[]; title: string; onDone: () => void } | null>(null)

  const toggleSelect = useCallback((orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId)
      return next
    })
  }, [])

  const toggleZone = useCallback((orderIds: string[], selectAll: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of orderIds) { if (selectAll) next.add(id); else next.delete(id) }
      return next
    })
  }, [])

  const handleBook = useCallback((ordersToBook: LalamoveOrder[], title: string, onDone: () => void) => {
    setBooking({ orders: ordersToBook, title, onDone })
  }, [])

  // Load existing saved batches for selected date
  async function loadExistingBatches() {
    setLoadingExisting(true)
    try {
      const res = await fetch(`/api/admin/delivery-batches?date=${date}`)
      const { batches } = await res.json() as { batches: SavedBatch[] }
      if (!batches || batches.length === 0) {
        toast('No batch tersave untuk tarikh ini')
        setLoadingExisting(false)
        return
      }

      // Rebuild groups from saved batches
      const ordersMap = new Map(orders.map((o) => [o.id, o]))

      const restoredGroups: ZoneGroup[] = KV_ZONES.map((zone) => ({
        zone,
        orders: [],
        status: 'draft',
        savedId: undefined,
      }))

      for (const batch of batches) {
        const group = restoredGroups.find((g) => g.zone.id === batch.zone_id)
        if (!group) continue
        group.status = batch.status
        group.savedId = batch.id
        const sortedOrderIds = [...batch.delivery_batch_orders]
          .sort((a, b) => a.stop_sequence - b.stop_sequence)
          .map((bo) => bo.order_id)
        for (const oid of sortedOrderIds) {
          const o = ordersMap.get(oid)
          if (o) group.orders.push(o)
        }
      }

      setGroups(restoredGroups.filter((g) => g.orders.length > 0))
      setGenerated(true)
      setSaved(true)
      toast.success(`${batches.length} batch dimuatkan semula`)
    } catch {
      toast.error('Failed muatkan batch tersave')
    }
    setLoadingExisting(false)
  }

  // Filter orders by cutoff
  const filteredOrders = useMemo(() => {
    const cutoffMs = new Date(`${date}T${cutoff}:00+08:00`).getTime()
    return orders.filter((o) => {
      const orderMs = new Date(o.created_at).getTime()
      return statusFilter.includes(o.status) && orderMs <= cutoffMs
    })
  }, [orders, date, cutoff, statusFilter])

  function generateGroups() {
    const groupMap = new Map<string, ZoneGroup>()
    for (const zone of KV_ZONES) {
      groupMap.set(zone.id, { zone, orders: [], status: 'draft' })
    }
    let outsideKV = 0
    for (const order of filteredOrders) {
      const zone = getZone(getPostcode(order))
      if (!zone) { outsideKV++; continue }   // luar LK — tak disertakan (guna courier lain)
      groupMap.get(zone.id)!.orders.push(order)
    }
    const result = Array.from(groupMap.values()).filter((g) => g.orders.length > 0)
    setGroups(result)
    setGenerated(true)
    setSaved(false)
    const grouped = filteredOrders.length - outsideKV
    toast.success(`${grouped} order LK dibahagikan kepada ${result.length} zon${outsideKV ? ` · ${outsideKV} luar LK diabaikan` : ''}`)
  }

  // Save all groups to DB
  async function saveBatches() {
    if (!groups) return
    setSaving(true)
    try {
      const payload = {
        date,
        cutoff_time: cutoff,
        groups: groups
          .filter((g) => g.orders.length > 0)
          .map((g) => ({
            zone_id: g.zone.id,
            zone_name: g.zone.name,
            status: g.status,
            order_ids: g.orders.map((o) => o.id),
          })),
      }

      const res = await fetch('/api/admin/delivery-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed save batch')
        setSaving(false)
        return
      }

      setSaved(true)
      toast.success('Batch success disave!')

      // Reload to get savedIds
      await loadExistingBatches()
    } catch {
      toast.error('Ralat rangkaian')
    }
    setSaving(false)
  }

  // Update single batch status in DB + local state
  const handleStatusChange = useCallback(async (zoneId: string, status: BatchStatus) => {
    setGroups((prev) =>
      prev ? prev.map((g) => g.zone.id === zoneId ? { ...g, status } : g) : prev
    )

    // If saved, push to DB immediately
    const group = groups?.find((g) => g.zone.id === zoneId)
    if (group?.savedId) {
      const res = await fetch(`/api/admin/delivery-batches/${group.savedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) toast.error('Failed update status')
    }
  }, [groups])

  const handleMove = useCallback((orderId: string, fromZoneId: string, toZoneId: string) => {
    if (fromZoneId === toZoneId) return
    setSaved(false)
    setGroups((prev) => {
      if (!prev) return prev
      const next = prev.map((g) => ({ ...g, orders: [...g.orders] }))
      const from = next.find((g) => g.zone.id === fromZoneId)
      const to = next.find((g) => g.zone.id === toZoneId)
      if (!from || !to) return prev
      const idx = from.orders.findIndex((o) => o.id === orderId)
      if (idx === -1) return prev
      const [moved] = from.orders.splice(idx, 1)
      to.orders.push(moved)
      return next
    })
  }, [])

  function copyAll() {
    if (!groups) return
    const allText = groups
      .filter((g) => g.orders.length > 0)
      .map((g) => `=== ${g.zone.emoji} ${g.zone.name} (${g.orders.length} order) ===\n${formatCopyList(g.orders)}`)
      .join('\n\n')
    navigator.clipboard.writeText(allText).then(() => toast.success('All batch disalin!'))
  }

  const totalOrders = orders.length
  const filteredCount = filteredOrders.length

  return (
    <div className="space-y-5">

      {/* ── Controls ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              <Calendar className="h-3 w-3 inline mr-1" />Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setGenerated(false); setSaved(false) }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              <Clock className="h-3 w-3 inline mr-1" />Cutoff Order
            </label>
            <input
              type="time"
              value={cutoff}
              onChange={(e) => { setCutoff(e.target.value); setGenerated(false); setSaved(false) }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-fresh-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">Order sebelum {cutoff} sahaja</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              <Filter className="h-3 w-3 inline mr-1" />Status Orders
            </label>
            <div className="flex flex-wrap gap-2">
              {['confirmed', 'preparing', 'delivering'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStatusFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
                    setGenerated(false)
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                    statusFilter.includes(s)
                      ? 'border-brand-fresh-400 bg-brand-fresh-50 text-brand-fresh-700'
                      : 'border-gray-100 bg-gray-50 text-gray-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Package className="h-4 w-4" />
            <span><strong className="text-gray-900">{totalOrders}</strong> belum dihantar</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span><strong className="text-gray-900">{filteredCount}</strong> sebelum {cutoff}</span>
          </div>
          {filteredCount === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-orange-500">
              <AlertCircle className="h-3.5 w-3.5" />No order dalam kriteria ini
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={generateGroups}
            disabled={filteredCount === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white font-bold py-3 rounded-2xl text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            <Truck className="h-4 w-4" />
            Generate Groups ({filteredCount} order)
            <RefreshCw className="h-3.5 w-3.5 opacity-60" />
          </button>

          <button
            onClick={loadExistingBatches}
            disabled={loadingExisting}
            className="flex items-center gap-2 px-4 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-2xl text-sm hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Muatkan batch tersave"
          >
            {loadingExisting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Muatkan Tersave
          </button>

          {/* Export Excel (format TikTok) untuk import ke syababfresh-app */}
          <a
            href="/api/admin/lalamove-export"
            download
            className="flex items-center gap-2 px-4 py-3 border-2 border-emerald-200 text-emerald-700 font-semibold rounded-2xl text-sm hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
            title="Export order Lalamove (KV, belum dihantar) ke Excel — untuk import ke syababfresh-app"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </a>
        </div>
      </div>

      {/* ── Groups ── */}
      {generated && groups && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900">
                {groups.filter((g) => g.orders.length > 0).length} zon · {groups.reduce((n, g) => n + g.orders.length, 0)} order LK
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Order luar LK tidak disertakan · guna dropdown untuk pindah zon</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Save badge */}
              {saved && (
                <span className="flex items-center gap-1 text-xs text-brand-fresh-600 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Tersave
                </span>
              )}
              {!saved && generated && (
                <span className="text-xs text-orange-500 font-semibold">● Belum disave</span>
              )}

              {/* Copy All */}
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />Copy All
              </button>

              {/* Save to DB */}
              <button
                onClick={saveBatches}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-fresh-500 text-white text-xs font-bold rounded-xl hover:bg-brand-fresh-600 disabled:opacity-50 transition-colors shadow-sm"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? 'Menyimpan...' : 'Save Batch'}
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            {groups.filter((g) => g.orders.length > 0).map((group) => (
              <ZoneGroupCard
                key={group.zone.id}
                group={group}
                zones={groups}
                onMove={handleMove}
                onStatusChange={handleStatusChange}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleZone={toggleZone}
                onBook={handleBook}
              />
            ))}
            {groups.every((g) => g.orders.length === 0) && (
              <div className="text-center py-12 text-gray-400">
                <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No order untuk dikumpulkan</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Bar pilihan melekat (gabung order terpilih jadi satu booking) ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-900">{selectedIds.size} order dipilih</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 font-semibold">
              Kosongkan
            </button>
            <button
              onClick={() => {
                const sel = (groups ?? []).flatMap((g) => g.orders).filter((o) => selectedIds.has(o.id))
                handleBook(sel, `${selectedIds.size} order dipilih`, () => setSelectedIds(new Set()))
              }}
              className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 shadow-sm"
            >
              <Send className="h-4 w-4" /> Hantar ke Lalamove
            </button>
          </div>
        </div>
      )}

      {/* ── Modal booking (per-zon ATAU pilihan) ── */}
      {booking && (
        <LalamoveBookModal
          orders={booking.orders}
          title={booking.title}
          onClose={() => setBooking(null)}
          onBooked={(ids) => {
            booking.onDone()
            setSelectedIds((prev) => { const next = new Set(prev); ids.forEach((i) => next.delete(i)); return next })
          }}
        />
      )}
    </div>
  )
}
