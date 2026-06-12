export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { handleOrderDelivered } from '@/lib/order-delivered'
import { awardLpLoyalty } from '@/lib/lp-loyalty'
import { sendDeliveryStatusEmail } from '@/lib/zeptomail'

// POST /api/lalamove/sync-delivered?secret=<LALAMOVE_WEBHOOK_SECRET>
// Body: { order_number, status? }
//
// Dipanggil oleh syababfresh-app (yang uruskan dispatch) bila courier COMPLETED.
// Tandakan order storefront/LP → delivered + loyalty + hantar EMAIL delivered.
// TIADA WA di sini — WA dihantar oleh syababfresh-app (channel berasingan, elak double;
// TikTok takde email jadi WA sahaja). Email digate pada peralihan status sebenar =
// idempotent (webhook berulang tak hantar email dua kali). Additive sahaja.
export async function POST(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret')
  if (!process.env.LALAMOVE_WEBHOOK_SECRET || secret !== process.env.LALAMOVE_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: any = null
  try { body = await req.json() } catch { return Response.json({ ok: true, ignored: 'bad json' }) }
  const orderNumber: string | undefined = body?.order_number ?? body?.orderNumber
  if (!orderNumber) return Response.json({ ok: true, ignored: 'no order_number' }, { status: 200 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // ── Storefront order ──────────────────────────────────────────────────────
  const { data: sf } = await admin.from('orders').select('id, status, user_id').eq('order_number', orderNumber).maybeSingle()
  if (sf) {
    const { data: synced } = await admin
      .from('orders')
      .update({ status: 'delivered', delivered_at: now })
      .eq('id', sf.id)
      .in('status', ['delivering', 'preparing', 'confirmed'])
      .select('id')
    if (synced?.length) {
      await handleOrderDelivered(admin, sf.id)   // loyalty + referral + affiliate
      // Email delivered (storefront ada email customer; WA dihantar oleh syababfresh-app)
      if (sf.user_id) {
        const { data: p } = await admin.from('profiles').select('full_name, email').eq('id', sf.user_id).maybeSingle()
        if (p?.email) {
          await sendDeliveryStatusEmail({
            to: p.email, customerName: p.full_name ?? 'Pelanggan',
            orderNumber, status: 'delivered', orderId: sf.id,
          }).catch(() => {})
        }
      }
    }
    return Response.json({ ok: true, matched: 'storefront', delivered: !!synced?.length })
  }

  // ── LP guest order ────────────────────────────────────────────────────────
  const { data: lp } = await admin
    .from('lp_guest_orders')
    .select('id, order_number, status, name, email, phone, total, payment_method, payment_status, user_id, source')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (lp) {
    const { data: synced } = await admin
      .from('lp_guest_orders')
      .update({ status: 'delivered', delivered_at: now, updated_at: now })
      .eq('id', lp.id)
      .in('status', ['delivering', 'preparing', 'confirmed'])
      .select('id')
    if (synced?.length) {
      await awardLpLoyalty(admin, lp).catch(() => {})
      // Email delivered untuk LP (guest tiada halaman /orders → orderId disorok)
      if (lp.email) {
        await sendDeliveryStatusEmail({
          to: lp.email, customerName: lp.name ?? 'Pelanggan',
          orderNumber, status: 'delivered',
        }).catch(() => {})
      }
    }
    return Response.json({ ok: true, matched: 'lp', delivered: !!synced?.length })
  }

  return Response.json({ ok: true, ignored: 'order not found', order_number: orderNumber })
}
