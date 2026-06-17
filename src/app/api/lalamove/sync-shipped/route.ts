export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'

// POST /api/lalamove/sync-shipped?secret=<LALAMOVE_WEBHOOK_SECRET>
// Body: { order_number, courier, tracking_number, tracking_url }
//
// Dipanggil oleh syababfresh-app bila AWB dibook (Poslaju/Ninja/Lalamove). Tanda order
// storefront/LP → delivering + simpan tracking (order page papar) + hantar EMAIL
// "dalam penghantaran". TIADA WA di sini — WA dihantar oleh syababfresh-app (channel
// berasingan, elak double). Email digate pada peralihan status = idempotent. Additive.

const CARRIER_MAP: Record<string, string> = { POSLAJU: 'poslaju', NINJA: 'ninja_cold', LALAMOVE: 'lalamove' }

export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (!process.env.LALAMOVE_WEBHOOK_SECRET || secret !== process.env.LALAMOVE_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null
  try { body = await req.json() } catch { return Response.json({ ok: true, ignored: 'bad json' }) }
  const orderNumber: string | undefined = body?.order_number ?? body?.orderNumber
  if (!orderNumber) return Response.json({ ok: true, ignored: 'no order_number' })

  const trackingNumber: string | null = body?.tracking_number ?? null
  const trackingUrl: string | null = body?.tracking_url ?? null
  const carrierId = CARRIER_MAP[String(body?.courier ?? '').toUpperCase()] ?? (String(body?.courier ?? '').toLowerCase() || null)

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // ── Storefront order ──────────────────────────────────────────────────────
  const { data: sf } = await admin.from('orders').select('id, status, user_id').eq('order_number', orderNumber).maybeSingle()
  if (sf) {
    // Simpan tracking (primary shipment) supaya order page papar jejak
    if (trackingNumber && carrierId) {
      const { data: existing } = await admin.from('order_shipments').select('id').eq('order_id', sf.id).is('refund_id', null).maybeSingle()
      if (existing) {
        // Re-sync (mis. admin re-import tracking) → kemaskini tracking SAHAJA. Jangan
        // tetapkan semula status/shipped_at supaya order yang dah maju (delivered) tak
        // diregres balik ke in_transit.
        await admin.from('order_shipments').update({ carrier_id: carrierId, tracking_number: trackingNumber, tracking_url: trackingUrl, updated_at: now }).eq('id', existing.id)
      } else {
        await admin.from('order_shipments').insert({ order_id: sf.id, carrier_id: carrierId, tracking_number: trackingNumber, tracking_url: trackingUrl, status: 'in_transit', shipped_at: now, updated_at: now })
      }
    }
    const { data: synced } = await admin
      .from('orders')
      .update({ status: 'delivering', delivering_at: now })
      .eq('id', sf.id)
      .in('status', ['confirmed', 'preparing'])
      .select('id')
    if (synced?.length && sf.user_id) {
      const { data: p } = await admin.from('profiles').select('full_name, email').eq('id', sf.user_id).maybeSingle()
      if (p?.email) {
        await sendDeliveryStatusEmail({
          to: p.email, customerName: p.full_name ?? 'Pelanggan',
          orderNumber, status: 'delivering', orderId: sf.id,
        }).catch(() => {})
      }
    }
    return Response.json({ ok: true, matched: 'storefront', shipped: !!synced?.length })
  }

  // ── LP guest order ────────────────────────────────────────────────────────
  const { data: lp } = await admin
    .from('lp_guest_orders')
    .select('id, status, name, email')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (lp) {
    const { data: synced } = await admin
      .from('lp_guest_orders')
      .update({ status: 'delivering', delivering_at: now, tracking_number: trackingNumber, tracking_url: trackingUrl, updated_at: now })
      .eq('id', lp.id)
      .in('status', ['confirmed', 'preparing'])
      .select('id')
    if (synced?.length && lp.email) {
      await sendDeliveryStatusEmail({
        to: lp.email, customerName: lp.name ?? 'Pelanggan',
        orderNumber, status: 'delivering',
      }).catch(() => {})
    }
    return Response.json({ ok: true, matched: 'lp', shipped: !!synced?.length })
  }

  return Response.json({ ok: true, ignored: 'order not found', order_number: orderNumber })
}
