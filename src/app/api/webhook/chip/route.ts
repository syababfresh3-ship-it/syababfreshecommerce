import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'
import { createVerify } from 'crypto'
import { sendPaymentConfirmedEmail } from '@/lib/zeptomail'
import { sendAdminPush } from '@/lib/push'
import { getWaTemplates, buildConfirmationMessage } from '@/lib/wa-templates'

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
    const pem = (typeof data === 'string' ? data : data?.public_key ?? '').replace(/\\n/g, '\n')
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
  // the webhook in the CHIP dashboard). PEM may be pasted with literal \n.
  const fromEnv = process.env.CHIP_PUBLIC_KEY
  if (fromEnv) keys.push(fromEnv.replace(/\\n/g, '\n'))
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

  // Defensive payload parsing — a registered webhook wraps the purchase as
  // { event_type, purchase }, but a per-purchase success_callback POSTs the
  // bare Purchase object (status/reference/id at the top level).
  const purchase = body.purchase ?? body
  const eventType: string | null = body.event_type ?? null
  const purchaseStatus: string | null = purchase?.status ?? null
  const orderId: string | null = purchase?.reference ?? null

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

  // Resolve outcome — prefer event_type when present, else fall back to purchase status
  const FAILURE_EVENTS = ['purchase.failed', 'purchase.cancelled', 'purchase.expired']
  const FAILURE_STATUSES = ['error', 'cancelled', 'expired']
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

  // Idempotency — only process if still unpaid
  // Use maybeSingle() to avoid PGRST116 error when LP order ID is passed (not in orders table)
  const { data: updated } = await supabase
    .from('orders')
    .update({ payment_status: 'paid', status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('payment_status', 'unpaid')
    .select(`
      id, user_id, total, order_number, payment_method,
      delivery_address, delivery_slot, notes, points_used, promo_code_id,
      order_items(product_id, variant_id, product_name, quantity, unit_price, variant_name),
      profiles(full_name, phone, email, loyalty_tiers(multiplier))
    `)
    .maybeSingle()

  if (!updated) {
    console.log('[chip-webhook] not in orders table, trying lp_guest_orders for:', orderId)
    // Try LP guest order
    const { data: lpOrder } = await supabase
      .from('lp_guest_orders')
      .update({ status: 'confirmed', payment_status: 'paid' })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id, order_number, name, phone, total, items, payment_method, landing_pages(title)')
      .maybeSingle()

    console.log('[chip-webhook] lp_guest_orders update result:', lpOrder ? `confirmed ${(lpOrder as any).order_number}` : 'no match')
    if (lpOrder) {
      const lp = lpOrder as any
      // Loyalty points are earned on delivery (see landing-pages orders PATCH → 'delivered')
      const lpTitle = lp.landing_pages?.title ?? 'SyababFresh'
      const itemLines = ((lp.items as any[]) ?? [])
        .map((i: any) => `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} × ${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`)
        .join('\n')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'
      const templates = await getWaTemplates()

      // WhatsApp to customer — fully template-driven (editable in /admin/settings/whatsapp)
      sendWhatsApp(lp.phone, buildConfirmationMessage(templates, 'payment_confirmed', {
        name: lp.name,
        order_number: lp.order_number,
        lp_title: lpTitle,
        items: itemLines,
        total: Number(lp.total).toFixed(2),
        app_url: appUrl,
      })).catch(() => {})

      // WhatsApp to admin
      const adminPhone = process.env.ADMIN_WHATSAPP
      if (adminPhone) {
        sendWhatsApp(adminPhone, [
          `🛒 *Pesanan LP Baru — ${lp.order_number}*`,
          ``,
          `👤 *Pelanggan:* ${lp.name}`,
          `📱 *Telefon:* ${lp.phone}`,
          `🛍️ ${lpTitle}`,
          ``,
          itemLines,
          ``,
          `💰 *Jumlah:* RM${Number(lp.total).toFixed(2)}`,
          `💳 *Bayaran:* FPX ✅ Dibayar`,
        ].join('\n')).catch(() => {})
        sendAdminPush({
          title: `💳 LP FPX Dibayar — ${lp.order_number}`,
          body: `${lp.name} · RM${Number(lp.total).toFixed(2)}`,
          url: '/admin/fulfillment',
          tag: 'payment-confirmed',
        }).catch(() => {})
      }
    }
    return NextResponse.json({ ok: true })
  }

  const {
    user_id, total, order_number, payment_method, delivery_address, delivery_slot, notes,
    points_used, promo_code_id, order_items, profiles,
  } = updated as any

  // Deduct inventory per item — variant items use deduct_variant_stock, others use FIFO batches
  const deductResults = await Promise.all(
    (order_items ?? []).map((item: any) =>
      item.variant_id
        ? supabase.rpc('deduct_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity })
        : supabase.rpc('deduct_inventory', { p_product_id: item.product_id, p_quantity: item.quantity })
    )
  )

  const oversoldItems = (order_items ?? []).filter((_: any, i: number) => deductResults[i].error)
  if (oversoldItems.length > 0) {
    const names = oversoldItems.map((i: any) => i.product_name).join(', ')
    await supabase
      .from('orders')
      .update({ admin_notes: `⚠️ STOK TIDAK MENCUKUPI: ${names}. Hubungi pelanggan.` })
      .eq('id', orderId)

    // Send urgent separate WhatsApp alert — don't rely on admin noticing the order note
    const adminPhone = process.env.ADMIN_WHATSAPP
    if (adminPhone) {
      const urgentMsg = [
        `🚨 *STOK TIDAK MENCUKUPI — Tindakan Diperlukan*`,
        ``,
        `Pesanan *${order_number}* telah dibayar (RM${Number(total).toFixed(2)}) tetapi stok tidak mencukupi:`,
        ...oversoldItems.map((i: any) => `• ${i.product_name}`),
        ``,
        `Sila hubungi pelanggan: *${profiles?.full_name ?? '—'}* (${profiles?.phone ?? '—'})`,
        `untuk maklumkan kelewatan / tawaran penggantian.`,
      ].join('\n')
      sendWhatsApp(adminPhone, urgentMsg).catch(() => {})
    }
  }

  // Deduct loyalty points used (points_used stored on order, safe to apply now that payment confirmed)
  if (points_used > 0) {
    await supabase.from('loyalty_transactions').insert({
      user_id,
      order_id: orderId,
      points: -points_used,
      type: 'redeem',
      description: `Redeem ${points_used} mata untuk ${order_number}`,
    })
    await supabase.rpc('increment_points', { uid: user_id, pts: -points_used })
  }

  // Earned points + spend are awarded on delivery (see admin orders PATCH → 'delivered'),
  // not at payment. Only the redeem deduction above happens here.

  // Increment promo usage now that payment is confirmed
  if (promo_code_id) {
    await supabase.rpc('increment_promo_uses', { promo_id: promo_code_id })
  }

  // Send payment confirmed email to customer
  const customerEmail = profiles?.email
  if (customerEmail) {
    sendPaymentConfirmedEmail({
      to: customerEmail,
      customerName: profiles?.full_name ?? 'Pelanggan',
      orderNumber: order_number,
      items: (order_items ?? []).map((i: any) => ({
        name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        variant_name: i.variant_name ?? null,
      })),
      total: Number(total),
      deliveryAddress: delivery_address ?? null,
      deliverySlot: delivery_slot ?? null,
      notes: notes ?? null,
    }).catch(err => console.error('[chip-webhook] email error:', err))
  }

  // Notify admin via WhatsApp
  const adminPhone = process.env.ADMIN_WHATSAPP
  if (adminPhone) {
    const paymentLabel: Record<string, string> = {
      fpx: 'FPX', ewallet: 'E-Wallet', cod: 'COD', bank_transfer: 'Pindahan Bank',
    }
    const itemLines = (order_items ?? [])
      .map((i: any) => `• ${i.product_name} x${i.quantity} — RM${(Number(i.unit_price) * i.quantity).toFixed(2)}`)
      .join('\n')
    const stockWarning = oversoldItems.length > 0
      ? `\n\n⚠️ *STOK TIDAK MENCUKUPI:* ${oversoldItems.map((i: any) => i.product_name).join(', ')}`
      : ''
    const message = [
      `🛒 *Pesanan Baru — ${order_number}*`,
      ``,
      `👤 *Pelanggan:* ${profiles?.full_name ?? '—'}`,
      `📱 *Telefon:* ${profiles?.phone ?? '—'}`,
      ``,
      `🧺 *Item:*`,
      itemLines,
      ``,
      `💰 *Jumlah:* RM${Number(total).toFixed(2)}`,
      `💳 *Bayaran:* ${paymentLabel[payment_method] ?? payment_method} ✅ Dibayar`,
      ``,
      `📍 *Alamat:*`,
      delivery_address ?? '—',
      notes ? `\n📝 *Nota:* ${notes}` : '',
      stockWarning,
    ].filter(Boolean).join('\n')
    sendWhatsApp(adminPhone, message).catch(() => {})
  }

  // Push notification to all admin devices
  sendAdminPush({
    title: `💳 FPX Dibayar — ${order_number}`,
    body: `${profiles?.full_name ?? 'Pelanggan'} · RM${Number(total).toFixed(2)}`,
    url: '/admin/fulfillment',
    tag: 'payment-confirmed',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
