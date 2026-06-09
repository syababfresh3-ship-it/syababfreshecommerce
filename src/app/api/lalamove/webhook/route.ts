export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { handleOrderDelivered } from '@/lib/order-delivered'
import { awardLpLoyalty } from '@/lib/lp-loyalty'
import { enqueueWhatsApp } from '@/lib/wa-outbox'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'
import { getWaCustomerTracking } from '@/lib/app-settings'
import type { SupabaseClient } from '@supabase/supabase-js'

// Webhook Lalamove (v3). Lalamove POST ke sini bila status order berubah.
// Keselamatan: secret dalam URL (?secret=) + hanya proses orderId yang WUJUD dalam
// rekod kita (order_shipments.tracking_number / lp_guest_orders.tracking_number).
// SENTIASA balas 200 untuk event sah (walau diabaikan) supaya Lalamove tak retry
// selamanya; 401 hanya untuk secret salah.
//
// Daftar URL di Lalamove Partner Portal → Webhooks:
//   https://shop.syababfresh.my/api/lalamove/webhook?secret=<LALAMOVE_WEBHOOK_SECRET>

export async function POST(req: Request) {
  // 1) Sahkan secret
  const secret = new URL(req.url).searchParams.get('secret')
  if (!process.env.LALAMOVE_WEBHOOK_SECRET || secret !== process.env.LALAMOVE_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 2) Parse payload (defensif — struktur Lalamove: { eventType, data: { order: {...} } })
  let body: any = null
  try { body = await req.json() } catch { return Response.json({ ok: true, ignored: 'bad json' }) }

  const eventType: string = body?.eventType ?? body?.event ?? ''
  const order = body?.data?.order ?? body?.order ?? body?.data ?? {}
  const lalamoveOrderId: string | undefined = order?.orderId ?? body?.data?.orderId ?? body?.orderId
  const status: string = order?.status ?? body?.data?.status ?? ''

  if (!lalamoveOrderId) return Response.json({ ok: true, ignored: 'no orderId' })

  const admin = createAdminClient()

  // 3) Padan orderId → order kita (storefront dulu, kemudian LP)
  const { data: ship } = await admin
    .from('order_shipments')
    .select('id, order_id')
    .eq('tracking_number', lalamoveOrderId)
    .is('refund_id', null)
    .maybeSingle()

  if (ship?.order_id) {
    await handleStorefront(admin, ship.id, ship.order_id, status)
    return Response.json({ ok: true, matched: 'storefront', status })
  }

  const { data: lp } = await admin
    .from('lp_guest_orders')
    .select('id, order_number, name, phone, email, total, payment_method, payment_status, user_id, source, status')
    .eq('tracking_number', lalamoveOrderId)
    .maybeSingle()

  if (lp) {
    await handleLp(admin, lp, status)
    return Response.json({ ok: true, matched: 'lp', status })
  }

  // Bukan order kita — abaikan (tetap 200)
  return Response.json({ ok: true, ignored: 'order not found', eventType })
}

// ─── Storefront ────────────────────────────────────────────────────────────────
async function handleStorefront(admin: SupabaseClient, shipId: string, orderId: string, status: string) {
  const now = new Date().toISOString()

  if (status === 'COMPLETED') {
    // Tandakan delivered (guard race → idempotent)
    const { data: synced } = await admin
      .from('orders')
      .update({ status: 'delivered', delivered_at: now })
      .eq('id', orderId)
      .in('status', ['delivering', 'preparing', 'confirmed'])
      .select('id')
    await admin.from('order_shipments').update({ status: 'delivered', delivered_at: now, updated_at: now }).eq('id', shipId)

    if (synced?.length) {
      await handleOrderDelivered(admin, orderId)   // loyalty + referral + affiliate
      await notifyStorefront(admin, orderId)        // email + WA + push "dah sampai"
    }
    return
  }

  if (['CANCELED', 'REJECTED', 'EXPIRED'].includes(status)) {
    // Gagal hantar → buang shipment & undur status supaya muncul semula di grouping
    await admin.from('order_shipments').delete().eq('id', shipId)
    await admin.from('orders').update({ status: 'preparing', delivering_at: null, updated_at: now })
      .eq('id', orderId).eq('status', 'delivering')
    return
  }

  // PICKED_UP / ON_GOING / ASSIGNING_DRIVER → kemaskini status shipment sahaja
  await admin.from('order_shipments').update({ status: 'in_transit', updated_at: now }).eq('id', shipId)
}

async function notifyStorefront(admin: SupabaseClient, orderId: string) {
  const { data: o } = await admin.from('orders').select('order_number, user_id').eq('id', orderId).single()
  if (!o) return
  const { data: p } = o.user_id
    ? await admin.from('profiles').select('full_name, phone, email').eq('id', o.user_id).maybeSingle()
    : { data: null }
  await sendNotifications(admin, {
    name: p?.full_name ?? 'Pelanggan',
    phone: p?.phone ?? null,
    email: p?.email ?? null,
    orderNumber: o.order_number,
    orderId,
  })
}

// ─── LP guest order ──────────────────────────────────────────────────────────
async function handleLp(admin: SupabaseClient, lp: any, status: string) {
  const now = new Date().toISOString()

  if (status === 'COMPLETED') {
    const { data: synced } = await admin
      .from('lp_guest_orders')
      .update({ status: 'delivered', delivered_at: now, updated_at: now })
      .eq('id', lp.id)
      .in('status', ['delivering', 'preparing', 'confirmed'])
      .select('id')
    if (synced?.length) {
      await awardLpLoyalty(admin, lp).catch(() => {})
      await sendNotifications(admin, {
        name: lp.name ?? 'Pelanggan',
        phone: lp.phone ?? null,
        email: lp.email ?? null,
        orderNumber: lp.order_number,
        orderId: undefined,   // LP guest tiada halaman /orders
      })
    }
    return
  }

  if (['CANCELED', 'REJECTED', 'EXPIRED'].includes(status)) {
    // Gagal → buang tracking & undur supaya muncul semula di grouping
    await admin.from('lp_guest_orders')
      .update({ tracking_number: null, tracking_url: null, status: 'preparing', delivering_at: null, updated_at: now })
      .eq('id', lp.id).eq('status', 'delivering')
  }
  // PICKED_UP/ON_GOING → tiada perubahan (LP tiada rekod shipment berasingan)
}

// ─── Notifikasi "dah sampai" — email (kalau ada) + WA (di-enqueue) ──────────────
async function sendNotifications(
  _admin: SupabaseClient,
  c: { name: string; phone: string | null; email: string | null; orderNumber: string; orderId?: string },
) {
  if (c.email) {
    await sendDeliveryStatusEmail({
      to: c.email,
      customerName: c.name,
      orderNumber: c.orderNumber,
      status: 'delivered',
      orderId: c.orderId,
    }).catch(() => {})
  }

  // WA hanya bila setting tracking bukan 'off' (elak ban — dipacing oleh drainer)
  if (c.phone && (await getWaCustomerTracking()) !== 'off') {
    const msg = [
      `📦 *Pesanan ${c.orderNumber} Telah Sampai!*`,
      ``,
      `Hai ${c.name}, pesanan anda telah selesai dihantar. Terima kasih! 🌿`,
      ``,
      `_SyababFresh — Buah Segar Setiap Hari_`,
    ].join('\n')
    await enqueueWhatsApp([{ phone: c.phone, message: msg, orderId: c.orderId ?? null, source: 'tracking' }])
  }
}
