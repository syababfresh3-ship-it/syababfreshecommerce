import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createVerify } from 'crypto'
import { confirmLpGuestOrder, confirmStorefrontOrder, normalizeChipPem } from '@/lib/order-confirm'

export const runtime = 'nodejs'

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

// CHIP signs callbacks with RSA (PKCS#1 v1.5, SHA256, base64) — verified with a
// public key, NOT an HMAC secret. There are two delivery mechanisms, each signed
// with a DIFFERENT key, so we accept the signature if EITHER key verifies:
//   1. per-purchase success_callback  → signed with the ACCOUNT key (GET /public_key/)
//   2. registered dashboard webhook   → signed with that WEBHOOK's own key (CHIP_PUBLIC_KEY)
let cachedAccountKey: string | null = null

async function fetchAccountPublicKey(): Promise<string | null> {
  if (cachedAccountKey) return cachedAccountKey
  const secret = process.env.CHIP_SECRET_KEY
  if (!secret) return null
  try {
    const res = await fetch(`${CHIP_API_URL}/public_key/`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (!res.ok) {
      console.error('[chip-webhook] public_key fetch failed:', res.status)
      return null
    }
    // CHIP returns the PEM either as a bare JSON string or { public_key: "..." }
    const data = await res.json()
    const pem = normalizeChipPem(typeof data === 'string' ? data : data?.public_key ?? '')
    if (pem) cachedAccountKey = pem
    return pem || null
  } catch (err) {
    console.error('[chip-webhook] public_key fetch error:', err)
    return null
  }
}

// All candidate keys to verify an incoming signature against.
async function getChipPublicKeys(): Promise<string[]> {
  const keys: string[] = []
  // Registered-webhook key (set CHIP_PUBLIC_KEY to the key shown when you create
  // the webhook in the CHIP dashboard). normalizeChipPem rebuilds a wrapped PEM
  // even when the env var is stored as a single line without newlines.
  const fromEnv = normalizeChipPem(process.env.CHIP_PUBLIC_KEY)
  if (fromEnv) keys.push(fromEnv)
  // Account key for per-purchase success_callback
  const accountKey = await fetchAccountPublicKey()
  if (accountKey) keys.push(accountKey)
  return keys
}

function verifySignature(rawBody: string, signature: string, publicKeyPem: string): boolean {
  try {
    return createVerify('RSA-SHA256').update(rawBody).verify(publicKeyPem, signature, 'base64')
  } catch (err) {
    console.error('[chip-webhook] signature verify error:', err)
    return false
  }
}

export async function POST(req: NextRequest) {
  let rawBody: string
  let body: any
  try {
    rawBody = await req.text()
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const signature = req.headers.get('x-signature')

  // CHIP puts reference/status at the TOP LEVEL for both the registered dashboard
  // webhook (rich payload) and the per-purchase success_callback (bare Purchase).
  // The nested `purchase` sub-object is configuration only — it has no reference/status.
  const eventType: string | null = body.event_type ?? null
  const purchaseStatus: string | null = body.status ?? body.purchase?.status ?? null
  const orderId: string | null = body.reference ?? body.purchase?.reference ?? null

  // Verify CHIP signature (RSA public-key — mandatory). Accept if any candidate key verifies.
  const publicKeys = await getChipPublicKeys()
  const verified = !!(signature && publicKeys.some(k => verifySignature(rawBody, signature, k)))

  // Audit log every callback (regardless of verification) for debugging / replay
  await supabase.from('webhook_logs').insert({
    source: 'chip',
    event_type: eventType,
    reference: orderId,
    status: purchaseStatus,
    verified,
    raw: body,
  }).then(({ error }) => { if (error) console.error('[chip-webhook] log insert error:', error.message) })

  if (publicKeys.length === 0) {
    console.error('[chip-webhook] No CHIP public key available (set CHIP_PUBLIC_KEY or CHIP_SECRET_KEY)')
    return NextResponse.json({ error: 'Payment gateway misconfigured' }, { status: 503 })
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  console.log('[chip-webhook] event:', eventType, 'reference:', orderId, 'status:', purchaseStatus)

  if (!orderId) return NextResponse.json({ ok: true })

  // Resolve outcome — prefer event_type when present, else fall back to purchase status.
  // NOTA: 'payment_failure' & 'error' adalah per-CUBAAN bayar (customer boleh cuba
  // lagi pada link sama). JANGAN cancel order atasnya — jika tidak, customer yang
  // berjaya pada cubaan kedua akan tersangkut "cancelled". Cancel HANYA bila
  // purchase betul-betul mati (cancelled/expired). Pass 1c cron jadi jaring jika terlepas.
  const FAILURE_EVENTS = ['purchase.cancelled', 'purchase.expired']
  const FAILURE_STATUSES = ['cancelled', 'expired']
  const outcome = eventType
    ? (eventType === 'purchase.paid' ? 'paid' : FAILURE_EVENTS.includes(eventType) ? 'failed' : 'other')
    : (purchaseStatus === 'paid' ? 'paid' : FAILURE_STATUSES.includes(purchaseStatus ?? '') ? 'failed' : 'other')

  // Auto-cancel order if payment failed, cancelled, or expired
  if (outcome === 'failed') {
    await Promise.all([
      supabase.from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', orderId).eq('payment_status', 'unpaid'),
      supabase.from('lp_guest_orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending'),
    ])
    return NextResponse.json({ ok: true })
  }

  if (outcome !== 'paid') {
    return NextResponse.json({ ok: true })
  }

  // Idempotent confirm — shared logic (also used by verify-payment fallback + cron).
  // Try storefront first; if it's not a storefront order (or already confirmed), try LP.
  const storefront = await confirmStorefrontOrder(supabase, orderId)
  if (storefront !== 'confirmed') {
    await confirmLpGuestOrder(supabase, orderId)
  }

  return NextResponse.json({ ok: true })
}
