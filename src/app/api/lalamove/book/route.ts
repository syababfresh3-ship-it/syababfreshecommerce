import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { placeOrder } from '@/lib/lalamove'
import { quoteForOrders, QuoteFlowError, type OrderInput, type QuotedRecipient } from '@/lib/lalamove-flow'
import { enqueueWhatsApp, type WaOutboxItem } from '@/lib/wa-outbox'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'
import { sendUserPush } from '@/lib/push'
import { getWaCustomerTracking } from '@/lib/app-settings'
import type { SupabaseClient } from '@supabase/supabase-js'

const LALAMOVE_CARRIER = 'lalamove'
const IS_SANDBOX = (process.env.LALAMOVE_BASE_URL ?? '').includes('sandbox')

// POST /api/lalamove/book
// Body: { serviceType?, orders: [{ id, name, phone, address, remarks?, uuid?, source? }] }
//
// Quote SEGAR + place order serentak (elak ERR_INVALID_SCHEDULE_TIME), kemudian
// rekod shipment (AWB) + majukan status + notify customer "dalam penghantaran"
// dengan link tracking live Lalamove. SANDBOX: tak sentuh DB / tak notify.
export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { serviceType, orders } = (await request.json()) as { serviceType?: string; orders: OrderInput[] }

  try {
    const q = await quoteForOrders(orders, serviceType ?? 'MOTORCYCLE')

    const result = await placeOrder({
      quotationId: q.quotationId,
      senderStopId: q.senderStopId,
      recipients: q.recipients.map((r) => ({ stopId: r.stopId, name: r.name, phone: r.phone, remarks: r.remarks })),
      metadata: { orderRefs: q.recipients.map((r) => r.orderId).join(',').slice(0, 100) },
    })

    // Rekod shipment (AWB) + majukan status + notify — PRODUCTION sahaja.
    let recorded = 0
    if (!IS_SANDBOX) {
      recorded = await recordShipments(supabase!, q.recipients, result.orderId, result.shareLink)
    }

    return NextResponse.json({
      orderId: result.orderId,
      shareLink: result.shareLink,
      status: result.status,
      total: result.priceBreakdown.total,
      currency: result.priceBreakdown.currency,
      booked: q.recipients.map((r) => r.orderId),
      flagged: q.flagged,
      recorded,
      sandbox: IS_SANDBOX,
    })
  } catch (err: any) {
    if (err instanceof QuoteFlowError) {
      return NextResponse.json({ error: err.message, flagged: err.flagged }, { status: err.status })
    }
    console.error('[lalamove/book]', err?.message, err?.body)
    return NextResponse.json({ error: err?.message ?? 'Book gagal', detail: err?.body }, { status: 502 })
  }
}

// Tulis order_shipments (storefront) / update lp_guest_orders (LP) untuk setiap
// penerima. Simpan Lalamove orderId dalam tracking_number (padan webhook Fasa 3)
// + shareLink dalam tracking_url. Majukan status confirmed/preparing → delivering,
// dan notify customer "dalam penghantaran" (WA + email + push) HANYA bila baru
// dimajukan (elak notify berganda kalau book semula).
async function recordShipments(
  admin: SupabaseClient,
  recipients: QuotedRecipient[],
  lalamoveOrderId: string,
  shareLink: string,
): Promise<number> {
  const now = new Date().toISOString()
  const waEnabled = (await getWaCustomerTracking()) !== 'off'
  const waQueue: WaOutboxItem[] = []
  let ok = 0

  for (const r of recipients) {
    if (!r.uuid || !r.source) continue   // tiada rujukan order — langkau

    try {
      let justDispatched = false
      let email: string | null = null
      let userId: string | null = null

      if (r.source === 'order') {
        const shipRow = {
          order_id: r.uuid, carrier_id: LALAMOVE_CARRIER,
          tracking_number: lalamoveOrderId, tracking_url: shareLink,
          status: 'in_transit', shipped_at: now, updated_at: now,
        }
        const { data: existing } = await admin
          .from('order_shipments').select('id').eq('order_id', r.uuid).is('refund_id', null).maybeSingle()
        const { error } = existing
          ? await admin.from('order_shipments').update(shipRow).eq('id', existing.id)
          : await admin.from('order_shipments').insert(shipRow)
        if (error) { console.error('[lalamove/book] shipment storefront gagal', r.orderId, error.message); continue }

        const { data: ord } = await admin.from('orders').select('status, user_id').eq('id', r.uuid).maybeSingle()
        if (ord && (ord.status === 'confirmed' || ord.status === 'preparing')) {
          await admin.from('orders').update({ status: 'delivering', delivering_at: now, updated_at: now }).eq('id', r.uuid)
          justDispatched = true
          userId = ord.user_id as string | null
          if (userId) {
            const { data: p } = await admin.from('profiles').select('email').eq('id', userId).maybeSingle()
            email = p?.email ?? null
          }
        }
      } else {
        const { data: lp } = await admin.from('lp_guest_orders').select('status, email').eq('id', r.uuid).maybeSingle()
        const advance = lp && (lp.status === 'confirmed' || lp.status === 'preparing')
        const { error } = await admin
          .from('lp_guest_orders')
          .update({
            courier_id: LALAMOVE_CARRIER, tracking_number: lalamoveOrderId, tracking_url: shareLink,
            ...(advance ? { status: 'delivering', delivering_at: now } : {}), updated_at: now,
          })
          .eq('id', r.uuid)
        if (error) { console.error('[lalamove/book] shipment LP gagal', r.orderId, error.message); continue }
        if (advance) { justDispatched = true; email = (lp?.email as string | null) ?? null }
      }
      ok++

      // Notify "dalam penghantaran" — hanya bila baru dimajukan
      if (justDispatched) {
        if (r.phone && waEnabled) {
          waQueue.push({
            phone: r.phone,
            message: [
              `🚚 *Pesanan ${r.orderId} Dalam Penghantaran!*`,
              ``,
              `Hai ${r.name}, pesanan anda sedang dalam perjalanan ke alamat anda.`,
              ``,
              `🔗 *Jejak penghantaran (live):*`,
              shareLink,
              ``,
              `_SyababFresh — Buah Segar Setiap Hari_ 🌿`,
            ].join('\n'),
            orderId: r.source === 'order' ? r.uuid : null,
            source: 'tracking',
          })
        }
        if (email) {
          sendDeliveryStatusEmail({
            to: email, customerName: r.name, orderNumber: r.orderId,
            status: 'delivering', orderId: r.source === 'order' ? r.uuid : undefined,
          }).catch(() => {})
        }
        if (r.source === 'order' && userId) {
          sendUserPush(userId, {
            title: 'Dalam Penghantaran 🚚',
            body: `Pesanan ${r.orderId} sedang dalam perjalanan ke alamat anda.`,
            url: `/orders/${r.uuid}`,
          }).catch(() => {})
        }
      }
    } catch (e: any) {
      console.error('[lalamove/book] rekod/notify ralat', r.orderId, e?.message)
    }
  }

  // Enqueue semua WA sekali (dipacing oleh drainer — elak ban)
  if (waQueue.length) await enqueueWhatsApp(waQueue).catch(() => {})
  return ok
}
