import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { placeOrder } from '@/lib/lalamove'
import { quoteForOrders, QuoteFlowError, type OrderInput, type QuotedRecipient } from '@/lib/lalamove-flow'
import type { SupabaseClient } from '@supabase/supabase-js'

const LALAMOVE_CARRIER = 'lalamove'
const IS_SANDBOX = (process.env.LALAMOVE_BASE_URL ?? '').includes('sandbox')

// POST /api/lalamove/book
// Body: { serviceType?, orders: [{ id, name, phone, address, remarks?, uuid?, source? }] }
// Pulang: { orderId, shareLink, status, total, currency, booked, flagged, recorded }
//
// Quote SEGAR + place order serentak (elak ERR_INVALID_SCHEDULE_TIME), kemudian
// rekod shipment (AWB digital) + majukan status — corak sama spt tracking-import.
// SANDBOX: tak sentuh DB (selamat uji). PRODUCTION: tulis shipment + status.
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

    // Rekod shipment (AWB) + majukan status — PRODUCTION sahaja.
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
      recorded,                 // berapa order direkod ke DB (0 dalam sandbox)
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
// penerima. Simpan Lalamove orderId dalam tracking_number (untuk padan webhook Fasa 3)
// + shareLink dalam tracking_url. Majukan status confirmed/preparing → delivering.
async function recordShipments(
  admin: SupabaseClient,
  recipients: QuotedRecipient[],
  lalamoveOrderId: string,
  shareLink: string,
): Promise<number> {
  const now = new Date().toISOString()
  let ok = 0

  for (const r of recipients) {
    if (!r.uuid || !r.source) continue   // tiada rujukan order — langkau (jangan silap tulis)

    try {
      if (r.source === 'order') {
        const shipRow = {
          order_id: r.uuid,
          carrier_id: LALAMOVE_CARRIER,
          tracking_number: lalamoveOrderId,   // padanan webhook Fasa 3
          tracking_url: shareLink,
          status: 'in_transit',
          shipped_at: now,
          updated_at: now,
        }
        const { data: existing } = await admin
          .from('order_shipments')
          .select('id')
          .eq('order_id', r.uuid)
          .is('refund_id', null)
          .maybeSingle()

        const { error } = existing
          ? await admin.from('order_shipments').update(shipRow).eq('id', existing.id)
          : await admin.from('order_shipments').insert(shipRow)
        if (error) { console.error('[lalamove/book] shipment storefront gagal', r.orderId, error.message); continue }

        // Majukan status order kalau masih confirmed/preparing
        const { data: ord } = await admin.from('orders').select('status').eq('id', r.uuid).maybeSingle()
        if (ord && (ord.status === 'confirmed' || ord.status === 'preparing')) {
          await admin.from('orders').update({ status: 'delivering', delivering_at: now, updated_at: now }).eq('id', r.uuid)
        }
      } else {
        // LP guest order — tracking disimpan terus pada lp_guest_orders
        const { data: lp } = await admin.from('lp_guest_orders').select('status').eq('id', r.uuid).maybeSingle()
        const advance = lp && (lp.status === 'confirmed' || lp.status === 'preparing')
        const { error } = await admin
          .from('lp_guest_orders')
          .update({
            courier_id: LALAMOVE_CARRIER,
            tracking_number: lalamoveOrderId,
            tracking_url: shareLink,
            ...(advance ? { status: 'delivering', delivering_at: now } : {}),
            updated_at: now,
          })
          .eq('id', r.uuid)
        if (error) { console.error('[lalamove/book] shipment LP gagal', r.orderId, error.message); continue }
      }
      ok++
    } catch (e: any) {
      console.error('[lalamove/book] rekod shipment ralat', r.orderId, e?.message)
    }
  }

  return ok
}
