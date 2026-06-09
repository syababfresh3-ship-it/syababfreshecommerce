// Lalamove v3 API client (SANDBOX/PRODUCTION ikut env).
// Alur: getQuotation() → placeOrder(). Auth guna HMAC-SHA256 setiap request.
//
// Dokumentasi: https://developers.lalamove.com/
// Env diperlukan: LALAMOVE_API_KEY, LALAMOVE_API_SECRET, LALAMOVE_MARKET,
//                 LALAMOVE_BASE_URL, LALAMOVE_SENDER_NAME, LALAMOVE_SENDER_PHONE

import crypto from 'crypto'
import { normalizePhone } from '@/lib/phone'

const API_KEY = process.env.LALAMOVE_API_KEY
const API_SECRET = process.env.LALAMOVE_API_SECRET
const MARKET = process.env.LALAMOVE_MARKET ?? 'MY'
const BASE_URL = process.env.LALAMOVE_BASE_URL ?? 'https://rest.sandbox.lalamove.com'

// Lalamove mahu telefon dalam E.164 (+60...). normalizePhone() bagi "60..." tanpa +.
export function toE164(phone: string | null | undefined): string {
  const p = normalizePhone(phone)
  return p ? `+${p}` : ''
}

export interface LalamoveStop {
  coordinates: { lat: string; lng: string }
  address: string
}

export interface LalamoveRecipient {
  stopId: string
  name: string
  phone: string        // E.164
  remarks?: string
}

export interface QuotationResult {
  quotationId: string
  stops: { stopId: string; coordinates: { lat: string; lng: string }; address: string }[]
  priceBreakdown: { total: string; currency: string }
  expiresAt: string
}

export interface PlaceOrderResult {
  orderId: string
  shareLink: string
  status: string
  priceBreakdown: { total: string; currency: string }
}

// ─── Core: signed request ─────────────────────────────────────────────────────

class LalamoveError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'LalamoveError'
    this.status = status
    this.body = body
  }
}

async function signedRequest<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, bodyObj?: unknown): Promise<T> {
  if (!API_KEY || !API_SECRET) throw new Error('LALAMOVE_API_KEY / LALAMOVE_API_SECRET tidak diset')

  const time = Date.now().toString()
  const body = bodyObj ? JSON.stringify(bodyObj) : ''

  // Format tandatangan v3: time \r\n method \r\n path \r\n \r\n body
  const rawSignature = `${time}\r\n${method}\r\n${path}\r\n\r\n${body}`
  const signature = crypto.createHmac('sha256', API_SECRET).update(rawSignature).digest('hex')
  const token = `${API_KEY}:${time}:${signature}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `hmac ${token}`,
      'Market': MARKET,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body || undefined,
  })

  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* biar json null */ }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message ?? json?.message ?? res.statusText
    throw new LalamoveError(`Lalamove ${method} ${path} gagal: ${msg}`, res.status, json ?? text)
  }
  return json as T
}

// ─── Quotation ────────────────────────────────────────────────────────────────

export async function getQuotation(
  stops: LalamoveStop[],
  serviceType = 'MOTORCYCLE',
): Promise<QuotationResult> {
  if (stops.length < 2) throw new Error('Quotation perlu sekurang-kurangnya 2 stop (pickup + 1 dropoff)')
  if (stops.length > 16) throw new Error('Lalamove had maksimum 16 stop (1 pickup + 15 dropoff)')

  const payload = {
    data: {
      serviceType,
      language: 'ms_MY',
      isRouteOptimized: true,   // Lalamove susun urutan stop untuk laluan terpendek
      stops: stops.map((s) => ({ coordinates: s.coordinates, address: s.address })),
    },
  }

  const res = await signedRequest<{ data: any }>('POST', '/v3/quotations', payload)
  const d = res.data
  return {
    quotationId: d.quotationId,
    stops: d.stops,
    priceBreakdown: { total: d.priceBreakdown?.total, currency: d.priceBreakdown?.currency },
    expiresAt: d.expiresAt,
  }
}

// ─── Place Order ──────────────────────────────────────────────────────────────

export async function placeOrder(opts: {
  quotationId: string
  senderStopId: string
  recipients: LalamoveRecipient[]
  metadata?: Record<string, string>
}): Promise<PlaceOrderResult> {
  const senderName = process.env.LALAMOVE_SENDER_NAME ?? 'Syabab Fresh'
  const senderPhone = toE164(process.env.LALAMOVE_SENDER_PHONE)

  const payload = {
    data: {
      quotationId: opts.quotationId,
      sender: { stopId: opts.senderStopId, name: senderName, phone: senderPhone },
      recipients: opts.recipients,
      isPODEnabled: true,          // bukti hantar (gambar/tandatangan) — perlu untuk Fasa 3
      isRecipientSMSEnabled: false, // kita uruskan notifikasi sendiri (WA/email)
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
    },
  }

  const res = await signedRequest<{ data: any }>('POST', '/v3/orders', payload)
  const d = res.data
  return {
    orderId: d.orderId,
    shareLink: d.shareLink,
    status: d.status,
    priceBreakdown: { total: d.priceBreakdown?.total, currency: d.priceBreakdown?.currency },
  }
}

// ─── Get order (untuk webhook/status nanti) ───────────────────────────────────

export async function getOrder(orderId: string): Promise<any> {
  const res = await signedRequest<{ data: any }>('GET', `/v3/orders/${orderId}`)
  return res.data
}

export { LalamoveError }
