export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createAdminClient } from '@/lib/supabase/admin'
import { handleOrderDelivered } from '@/lib/order-delivered'
import { awardLpLoyalty } from '@/lib/lp-loyalty'

// POST /api/lalamove/sync-delivered?secret=<LALAMOVE_WEBHOOK_SECRET>
// Body: { order_number, status? }
//
// Dipanggil oleh syababfresh-app (yang uruskan Lalamove) bila Lalamove COMPLETED.
// Tandakan order storefront/LP → delivered + loyalty. TIADA WA/email — sebab
// syababfresh-app yang blast customer. Idempotent (guard status). Additive sahaja.
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
  const { data: sf } = await admin.from('orders').select('id, status').eq('order_number', orderNumber).maybeSingle()
  if (sf) {
    const { data: synced } = await admin
      .from('orders')
      .update({ status: 'delivered', delivered_at: now })
      .eq('id', sf.id)
      .in('status', ['delivering', 'preparing', 'confirmed'])
      .select('id')
    if (synced?.length) await handleOrderDelivered(admin, sf.id)   // loyalty + referral + affiliate
    return Response.json({ ok: true, matched: 'storefront', delivered: !!synced?.length })
  }

  // ── LP guest order ────────────────────────────────────────────────────────
  const { data: lp } = await admin
    .from('lp_guest_orders')
    .select('id, order_number, status, phone, total, payment_method, payment_status, user_id, source')
    .eq('order_number', orderNumber)
    .maybeSingle()
  if (lp) {
    const { data: synced } = await admin
      .from('lp_guest_orders')
      .update({ status: 'delivered', delivered_at: now, updated_at: now })
      .eq('id', lp.id)
      .in('status', ['delivering', 'preparing', 'confirmed'])
      .select('id')
    if (synced?.length) await awardLpLoyalty(admin, lp).catch(() => {})
    return Response.json({ ok: true, matched: 'lp', delivered: !!synced?.length })
  }

  return Response.json({ ok: true, ignored: 'order not found', order_number: orderNumber })
}
