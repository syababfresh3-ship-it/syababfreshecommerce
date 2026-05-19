import crypto from 'crypto'
import { createAdminClient } from './supabase/admin'

const CAPI_URL = 'https://graph.facebook.com/v21.0'

function sha256(value: string) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

async function getPixelId(lpPixelId?: string | null): Promise<string | null> {
  if (lpPixelId) return lpPixelId
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'meta_pixel_id')
    .single()
  return data?.value ?? null
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
}: {
  orderId: string
  orderNumber: string
  total: number
  items: Array<{ productId: string; quantity: number; price: number }>
  userEmail?: string | null
  userPhone?: string | null
  userId?: string | null
}) {
  if (!process.env.META_CAPI_ACCESS_TOKEN) return
  const pixelId = await getPixelId()
  if (!pixelId) return

  const userData: Record<string, string> = {}
  if (userEmail) userData.em = sha256(userEmail)
  if (userPhone) userData.ph = sha256(userPhone.replace(/\D/g, ''))
  if (userId) userData.external_id = sha256(userId)

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
  lpPixelId,
}: {
  leadId: string
  pageSlug: string
  phone?: string | null
  lpPixelId?: string | null
}) {
  if (!process.env.META_CAPI_ACCESS_TOKEN) return
  const pixelId = await getPixelId(lpPixelId)
  if (!pixelId) return

  const userData: Record<string, string> = {}
  if (phone) userData.ph = sha256(phone.replace(/\D/g, ''))

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
