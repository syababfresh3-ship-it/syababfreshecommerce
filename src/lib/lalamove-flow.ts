// Alur kongsi: orders → geocode → quotation. Dipakai oleh /quote (preview harga)
// DAN /book (quote segar serentak sebelum place order — elak ERR_INVALID_SCHEDULE_TIME
// akibat quotation lama tamat tempoh masa staf baca modal).

import { geocodeAddress } from '@/lib/geocode'
import { getQuotation, toE164, type LalamoveStop } from '@/lib/lalamove'

export interface OrderInput {
  id: string             // order_number (untuk papar/flag/metadata)
  name: string
  phone: string
  address: string
  remarks?: string
  uuid?: string          // id sebenar order (untuk tulis shipment di /book)
  source?: 'order' | 'lp'
}

export interface QuotedRecipient {
  stopId: string
  orderId: string        // order_number
  name: string
  phone: string          // E.164
  remarks: string
  address: string
  uuid?: string          // id sebenar order
  source?: 'order' | 'lp'
}

export interface QuoteFlowResult {
  quotationId: string
  senderStopId: string
  total: string
  currency: string
  expiresAt: string
  recipients: QuotedRecipient[]
  flagged: { id: string; address: string; reason: string }[]
}

export class QuoteFlowError extends Error {
  status: number
  flagged?: unknown
  constructor(message: string, status: number, flagged?: unknown) {
    super(message)
    this.status = status
    this.flagged = flagged
  }
}

// Kotak sempadan luas meliputi KL + Selangor + margin. Tujuannya BUKAN untuk had
// ketat ke KV (grouping dah tapis poskod KV), tapi untuk tangkap geocode yang
// tersasar JAUH (negeri/negara lain) akibat alamat kabur — yang akan tolak quote.
function inKlangValley(lat: string, lng: string): boolean {
  const la = parseFloat(lat), lo = parseFloat(lng)
  return la >= 2.4 && la <= 3.8 && lo >= 100.8 && lo <= 102.2
}

export async function quoteForOrders(orders: OrderInput[], serviceType = 'MOTORCYCLE'): Promise<QuoteFlowResult> {
  if (!orders?.length) throw new QuoteFlowError('Tiada order', 400)
  if (orders.length > 15) throw new QuoteFlowError('Maksimum 15 penghantaran setiap order Lalamove', 400)

  const pickupAddr = process.env.LALAMOVE_PICKUP_ADDRESS
  if (!pickupAddr) throw new QuoteFlowError('LALAMOVE_PICKUP_ADDRESS tidak diset', 500)
  const pickup = await geocodeAddress(pickupAddr)
  if (!pickup) throw new QuoteFlowError('Gagal geocode alamat pickup (gudang)', 500)

  const flagged: { id: string; address: string; reason: string }[] = []
  const valid: { order: OrderInput; geo: NonNullable<Awaited<ReturnType<typeof geocodeAddress>>> }[] = []

  for (const o of orders) {
    if (!o.address?.trim()) { flagged.push({ id: o.id, address: o.address ?? '', reason: 'Tiada alamat' }); continue }
    if (!toE164(o.phone)) { flagged.push({ id: o.id, address: o.address, reason: 'Nombor telefon tidak sah' }); continue }
    const geo = await geocodeAddress(o.address)
    if (!geo) { flagged.push({ id: o.id, address: o.address, reason: 'Koordinat tidak dijumpai — alamat tak lengkap/kabur' }); continue }
    // Semakan sempadan: kalau geocode mendarat LUAR Lembah Klang/Selangor, alamat
    // kemungkinan tersasar (kabur/salah) → flag & keluarkan. Tanpa ini, satu stop
    // luar kawasan akan TOLAK seluruh quotation Lalamove ("out of service area").
    if (!inKlangValley(geo.lat, geo.lng)) {
      flagged.push({ id: o.id, address: o.address, reason: 'Koordinat luar kawasan servis (alamat mungkin tersasar — semak/betulkan)' })
      continue
    }
    valid.push({ order: o, geo })
  }

  if (valid.length === 0) throw new QuoteFlowError('Tiada alamat sah untuk quotation', 422, flagged)

  // PENTING: guna koordinat dari geocode (pin), TAPI teks alamat = alamat penuh ASAL
  // dari customer — Google formatted_address selalu buang detail (Lot xxxxx, unit,
  // tingkat, blok). Rumah tanah standalone perlu detail penuh supaya rider jumpa.
  const stops: LalamoveStop[] = [
    { coordinates: { lat: pickup.lat, lng: pickup.lng }, address: pickupAddr },
    ...valid.map((v) => ({ coordinates: { lat: v.geo.lat, lng: v.geo.lng }, address: v.order.address })),
  ]

  const quote = await getQuotation(stops, serviceType)

  // Route optimization boleh SUSUN SEMULA urutan stop dalam respons. Jadi padan
  // stop↔order ikut KOORDINAT (bukan urutan) supaya nama customer tak tertukar.
  // Lalamove echo balik koordinat yg kita hantar (cuma format beza, cth trailing 0),
  // jadi normalize ke 6 titik perpuluhan. Guna queue untuk handle koordinat sama.
  const coordKey = (c: { lat: string; lng: string }) =>
    `${parseFloat(c.lat).toFixed(6)}|${parseFloat(c.lng).toFixed(6)}`
  const stopQueue = new Map<string, string[]>()
  quote.stops.forEach((s) => {
    const k = coordKey(s.coordinates)
    if (!stopQueue.has(k)) stopQueue.set(k, [])
    stopQueue.get(k)!.push(s.stopId)
  })
  const takeStop = (lat: string, lng: string): string | undefined => stopQueue.get(coordKey({ lat, lng }))?.shift()

  const senderStopId = takeStop(pickup.lat, pickup.lng) ?? quote.stops[0].stopId

  return {
    quotationId: quote.quotationId,
    senderStopId,
    total: quote.priceBreakdown.total,
    currency: quote.priceBreakdown.currency,
    expiresAt: quote.expiresAt,
    recipients: valid.map((v) => {
      const stopId = takeStop(v.geo.lat, v.geo.lng)
      // Padanan koordinat WAJIB jumpa. Kalau tidak, lebih selamat GAGAL daripada
      // risiko assign parcel ke stop salah (parcel sampai customer salah).
      if (!stopId) throw new QuoteFlowError(`Gagal padan stop untuk ${v.order.id} — sila quote semula`, 502)
      return {
        stopId,
        orderId: v.order.id,
        name: v.order.name,
        phone: toE164(v.order.phone),
        remarks: v.order.remarks ?? '',
        address: v.order.address,      // alamat penuh asal customer (rider baca ini)
        uuid: v.order.uuid,
        source: v.order.source,
      }
    }),
    flagged,
  }
}
