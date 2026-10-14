import crypto from 'crypto'
import { getAppSettings } from './app-settings'

const CAPI_URL = 'https://graph.facebook.com/v21.0'

function sha256(value: string) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

function hashPhone(phone: string) {
  // Normalize: remove spaces, dashes, brackets, convert MY format 0x → 60x
  let p = phone.replace(/[\s\-\(\)]/g, '').replace(/[^0-9+]/g, '')
  if (p.startsWith('0')) p = '60' + p.slice(1)
  p = p.replace(/^\+/, '')
  return sha256(p)
}

function splitName(fullName: string): { fn?: string; ln?: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { fn: sha256(parts[0]) }
  return { fn: sha256(parts[0]), ln: sha256(parts.slice(1).join(' ')) }
}

async function getPixelId(lpPixelId?: string | null): Promise<string | null> {
  if (lpPixelId) return lpPixelId
  const settings = await getAppSettings()
  return settings.meta_pixel_id || null
}

async function sendCapiEvent(pixelId: string, payload: object) {
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!token) return
  try {
    const res = await fetch(`${CAPI_URL}/${pixelId}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (process.env.NODE_ENV === 'development') {
      const body = await res.json().catch(() => ({}))
      console.log('[meta-capi] sent:', res.status, body)
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error('[meta-capi] error:', err)
  }
}

export async function sendCapiPurchase({
  orderId,
  orderNumber,
  total,
  items,
  userEmail,
  userPhone,
  userId,
  customerName,
  clientIp,
  userAgent,
  fbc,
  fbp,
}: {
  orderId: string
  orderNumber: string
  total: number
  items: Array<{ productId: string; quantity: number; price: number }>
  userEmail?: string | null
  userPhone?: string | null
  userId?: string | null
  customerName?: string | null
  clientIp?: string | null
  userAgent?: string | null
  fbc?: string | null
  fbp?: string | null
}) {
  if (!process.env.META_CAPI_ACCESS_TOKEN) return
  const pixelId = await getPixelId()
  if (!pixelId) return

  const userData: Record<string, string> = {}
  if (userEmail) userData.em = sha256(userEmail)
  if (userPhone) userData.ph = hashPhone(userPhone)
  if (userId) userData.external_id = sha256(userId)
  if (customerName) Object.assign(userData, splitName(customerName))
  if (clientIp) userData.client_ip_address = clientIp
  if (userAgent) userData.client_user_agent = userAgent
  if (fbc) userData.fbc = fbc
  if (fbp) userData.fbp = fbp

  await sendCapiEvent(pixelId, {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `purchase_${orderNumber}`,
      action_source: 'website',
      event_source_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'}/checkout`,
      user_data: userData,
      custom_data: {
        currency: 'MYR',
        value: total,
        contents: items.map(i => ({ id: i.productId, quantity: i.quantity, item_price: i.price })),
        content_type: 'product',
        num_items: items.reduce((s, i) => s + i.quantity, 0),
        order_id: orderId,
      },
    }],
  })
}

export async function sendCapiLead({
  leadId,
  pageSlug,
  phone,
  name,
  lpPixelId,
  clientIp,
  userAgent,
  fbc,
  fbp,
}: {
  leadId: string
  pageSlug: string
  phone?: string | null
  name?: string | null
  lpPixelId?: string | null
  clientIp?: string | null
  userAgent?: string | null
  fbc?: string | null
  fbp?: string | null
}) {
  if (!process.env.META_CAPI_ACCESS_TOKEN) return
  const pixelId = await getPixelId(lpPixelId)
  if (!pixelId) return

  const userData: Record<string, string> = {}
  if (phone) userData.ph = hashPhone(phone)
  if (name) Object.assign(userData, splitName(name))
  if (clientIp) userData.client_ip_address = clientIp
  if (userAgent) userData.client_user_agent = userAgent
  if (fbc) userData.fbc = fbc
  if (fbp) userData.fbp = fbp

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

  await sendCapiEvent(pixelId, {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `lead_${leadId}`,
      action_source: 'website',
      event_source_url: `${baseUrl}/lp/${pageSlug}`,
      user_data: userData,
    }],
  })
}

// Lead pelayan untuk LP gift kurma (/kurma). event_id = eventID pixel pelayar (UUID dari
// kurma-track.ts) → Meta dedup pelayar+pelayan; pulihkan isyarat yang pixel hilang (iOS/adblock).
// Tiada PII (tiada borang sebelum WhatsApp) — padanan guna fbc/fbp cookie + IP + user-agent.
// Tiada `value` (anggaran bukan hasil) — hantar sebagai `estimate` + angle/UTM untuk segmen.
export async function sendCapiKurmaLead({
  eventId, label, angle, estimate, utm, clientIp, userAgent, fbc, fbp,
}: {
  eventId: string
  label: string
  angle?: string
  estimate?: number
  utm?: { source?: string; campaign?: string; content?: string }
  clientIp?: string | null
  userAgent?: string | null
  fbc?: string | null
  fbp?: string | null
}) {
  if (!process.env.META_CAPI_ACCESS_TOKEN) return
  const pixelId = await getPixelId()
  if (!pixelId) return

  const userData: Record<string, string> = {}
  if (clientIp) userData.client_ip_address = clientIp
  if (userAgent) userData.client_user_agent = userAgent
  if (fbc) userData.fbc = fbc
  if (fbp) userData.fbp = fbp

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'

  await sendCapiEvent(pixelId, {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: `${baseUrl}/kurma${angle ? `/${angle}` : ''}`,
      user_data: userData,
      custom_data: {
        content_name: label,
        content_category: 'gift-kurma',
        ...(angle ? { angle } : {}),
        ...(estimate ? { estimate } : {}),
        ...(utm?.source ? { utm_source: utm.source } : {}),
        ...(utm?.campaign ? { utm_campaign: utm.campaign } : {}),
        ...(utm?.content ? { utm_content: utm.content } : {}),
      },
    }],
  })
}

// Purchase conversion untuk order yang berasal dari iklan Click-to-WhatsApp (CTWA).
// Berbeza dari sendCapiPurchase (website): action_source = 'business_messaging' +
// messaging_channel = 'whatsapp', dan padanan guna `ctwa_clid` (click id dari webhook)
// bukan fbc/fbp. Hantar ke pixel/dataset yang SAMA supaya dedup event_id berfungsi.
export async function sendCapiPurchaseWhatsApp({
  orderId,
  orderNumber,
  total,
  phone,
  ctwa_clid,
}: {
  orderId: string
  orderNumber: string
  total: number
  phone?: string | null
  ctwa_clid: string
}) {
  if (!process.env.META_CAPI_ACCESS_TOKEN || !ctwa_clid) return
  // CTWA mesti pergi ke dataset yang disambung ke WhatsApp (boleh beza dari pixel
  // website). Guna META_CTWA_DATASET_ID kalau diset; jika tidak, fallback ke pixel.
  const pixelId = process.env.META_CTWA_DATASET_ID || (await getPixelId())
  if (!pixelId) return

  const userData: Record<string, string> = { ctwa_clid }
  if (process.env.WHATSAPP_WABA_ID) userData.whatsapp_business_account_id = process.env.WHATSAPP_WABA_ID
  if (phone) userData.ph = hashPhone(phone)

  await sendCapiEvent(pixelId, {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `purchase_${orderNumber}`,
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: userData,
      custom_data: {
        currency: 'MYR',
        value: total,
        order_id: orderId,
      },
    }],
  })
}

// Lead untuk CTWA — dipicu bila customer MULA chat dari iklan Click-to-WhatsApp
// (kita tangkap ctwa_clid di webhook). Bagi Meta signal top-of-funnel untuk
// optimize campaign objektif Leads. event_id dedup per click.
export async function sendCapiLeadWhatsApp({
  ctwa_clid,
  phone,
}: {
  ctwa_clid: string
  phone?: string | null
}) {
  if (!process.env.META_CAPI_ACCESS_TOKEN || !ctwa_clid) return
  const pixelId = process.env.META_CTWA_DATASET_ID || (await getPixelId())
  if (!pixelId) return

  const userData: Record<string, string> = { ctwa_clid }
  if (process.env.WHATSAPP_WABA_ID) userData.whatsapp_business_account_id = process.env.WHATSAPP_WABA_ID
  if (phone) userData.ph = hashPhone(phone)

  await sendCapiEvent(pixelId, {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: `lead_ctwa_${ctwa_clid}`,
      action_source: 'business_messaging',
      messaging_channel: 'whatsapp',
      user_data: userData,
    }],
  })
}
