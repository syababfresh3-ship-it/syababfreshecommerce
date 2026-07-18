export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { confirmLpGuestOrder, confirmStorefrontOrder } from '@/lib/order-confirm'
import { stampHeartbeat } from '@/lib/cron-heartbeat'

export const runtime = 'nodejs'

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'
// 'error' adalah per-cubaan & transient (customer boleh cuba lagi) → JANGAN cancel.
const FAILED_STATUSES = ['cancelled', 'expired']

// Safety net for CHIP payments the webhook + browser fallback both missed.
// Two passes:
//   1) Poll CHIP for every still-pending online order that has a stored
//      purchase id (payment_ref) → paid: confirm, failed/expired: cancel.
//   2) Replay logged purchase.paid webhooks — covers orders whose payment_ref
//      was never stored, and historical webhooks dropped before this fix. The
//      reference + chip purchase id are read straight from the raw payload and
//      re-verified against CHIP before confirming (so it's safe even though the
//      original webhook failed signature verification).
// Authorize via `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron sends this).
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const secret = process.env.CHIP_SECRET_KEY
  if (!secret) return Response.json({ ok: false, error: 'CHIP_SECRET_KEY missing' }, { status: 503 })

  const supabase = createAdminClient()
  // Reconcile orders created in the last 14 days, but skip the most recent 2 min
  // so we don't race a payment that is still mid-flight at the gateway.
  const windowStart = new Date(Date.now() - 14 * 864e5).toISOString()
  const minAge = new Date(Date.now() - 2 * 60 * 1000).toISOString()

  async function chipStatus(purchaseId: string): Promise<string | null> {
    try {
      const r = await fetch(`${CHIP_API_URL}/purchases/${purchaseId}/`, {
        headers: { Authorization: `Bearer ${secret}` },
      })
      if (!r.ok) return null
      const p = await r.json()
      return p?.status ?? null
    } catch {
      return null
    }
  }

  const summary = {
    lp: { checked: 0, confirmed: 0, cancelled: 0, recovered: 0 },
    storefront: { checked: 0, confirmed: 0, cancelled: 0, recovered: 0 },
    replay: { scanned: 0, confirmed: 0 },
  }

  // ── Pass 1a: LP guest orders with a stored purchase id ──────────────
  const { data: lpRows } = await supabase
    .from('lp_guest_orders')
    .select('id, payment_ref')
    .eq('status', 'pending')
    .in('payment_method', ['fpx', 'ewallet'])
    .not('payment_ref', 'is', null)
    .gte('created_at', windowStart)
    .lte('created_at', minAge)
    .limit(200)

  for (const row of lpRows ?? []) {
    summary.lp.checked++
    const status = await chipStatus(row.payment_ref as string)
    if (status === 'paid') {
      const r = await confirmLpGuestOrder(supabase, row.id)
      if (r === 'confirmed') summary.lp.confirmed++
    } else if (status && FAILED_STATUSES.includes(status)) {
      await supabase.from('lp_guest_orders').update({ status: 'cancelled' }).eq('id', row.id).eq('status', 'pending')
      summary.lp.cancelled++
    }
  }

  // ── Pass 1b: storefront orders with a stored purchase id ────────────
  const { data: ordRows } = await supabase
    .from('orders')
    .select('id, payment_ref')
    .eq('payment_status', 'unpaid')
    .in('payment_method', ['fpx', 'ewallet'])
    .not('payment_ref', 'is', null)
    .gte('created_at', windowStart)
    .lte('created_at', minAge)
    .limit(200)

  for (const row of ordRows ?? []) {
    summary.storefront.checked++
    const status = await chipStatus(row.payment_ref as string)
    if (status === 'paid') {
      const r = await confirmStorefrontOrder(supabase, row.id)
      if (r === 'confirmed') summary.storefront.confirmed++
    } else if (status && FAILED_STATUSES.includes(status)) {
      await supabase.from('orders')
        .update({ status: 'cancelled', payment_status: 'failed' })
        .eq('id', row.id).eq('payment_status', 'unpaid')
      summary.storefront.cancelled++
    }
  }

  // ── Pass 1c: pulihkan order CANCELLED-tapi-PAID ─────────────────────
  // Pass 1a/1b cuma semak order belum-selesai. Order yang ter-cancelled (cth
  // webhook 'expired' silap, atau cancel sebelum customer bayar) tak pernah
  // dicheck balik — walaupun CHIP kemudian tunjuk paid → sale hilang. Di sini
  // re-semak order cancelled (ada pay link, 14 hari) vs CHIP; kalau paid →
  // re-open + confirm penuh (loyalty/email via confirm*Order).
  const { data: lpCancelled } = await supabase
    .from('lp_guest_orders')
    .select('id, payment_ref')
    .eq('status', 'cancelled')
    .neq('payment_status', 'paid')
    .in('payment_method', ['fpx', 'ewallet'])
    .not('payment_ref', 'is', null)
    .gte('created_at', windowStart)
    .lte('created_at', minAge)
    .limit(200)

  for (const row of lpCancelled ?? []) {
    const status = await chipStatus(row.payment_ref as string)
    if (status === 'paid') {
      // Re-open pending supaya confirmLpGuestOrder (guard status='pending') boleh confirm penuh.
      await supabase.from('lp_guest_orders').update({ status: 'pending' }).eq('id', row.id).eq('status', 'cancelled')
      const r = await confirmLpGuestOrder(supabase, row.id)
      if (r === 'confirmed') summary.lp.recovered++
    }
  }

  const { data: ordCancelled } = await supabase
    .from('orders')
    .select('id, payment_ref')
    .eq('status', 'cancelled')
    .neq('payment_status', 'paid')
    .in('payment_method', ['fpx', 'ewallet'])
    .not('payment_ref', 'is', null)
    .gte('created_at', windowStart)
    .lte('created_at', minAge)
    .limit(200)

  for (const row of ordCancelled ?? []) {
    const status = await chipStatus(row.payment_ref as string)
    if (status === 'paid') {
      // Set semula unpaid supaya confirmStorefrontOrder (guard payment_status='unpaid') boleh confirm.
      await supabase.from('orders').update({ payment_status: 'unpaid' }).eq('id', row.id).eq('status', 'cancelled')
      const r = await confirmStorefrontOrder(supabase, row.id)
      if (r === 'confirmed') summary.storefront.recovered++
    }
  }

  // ── Pass 2: replay logged purchase.paid webhooks ────────────────────
  // Catches orders Pass 1 can't (payment_ref null) and webhooks dropped before
  // the reference/signature fix. We re-verify each against CHIP before trusting.
  // Match both delivery shapes: the dashboard webhook (event_type='purchase.paid')
  // and the per-purchase success_callback (bare Purchase: status='paid', no event_type).
  const { data: paidLogs } = await supabase
    .from('webhook_logs')
    .select('raw')
    .eq('source', 'chip')
    .or('event_type.eq.purchase.paid,status.eq.paid')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(1000)

  const seen = new Set<string>()
  for (const log of paidLogs ?? []) {
    const raw = (log.raw ?? {}) as any
    const ref: string | undefined = raw.reference ?? raw.purchase?.reference
    const chipId: string | undefined = raw.id
    if (!ref || !chipId || seen.has(ref)) continue
    seen.add(ref)

    // Only do work if the order is still unconfirmed — cheap DB check first.
    const { data: ord } = await supabase
      .from('orders')
      .select('id, payment_ref, payment_status')
      .eq('id', ref)
      .maybeSingle()

    if (ord) {
      if (ord.payment_status === 'paid') continue
      summary.replay.scanned++
      if (await chipStatus(chipId) !== 'paid') continue
      if (!ord.payment_ref) await supabase.from('orders').update({ payment_ref: chipId }).eq('id', ref)
      const r = await confirmStorefrontOrder(supabase, ref)
      if (r === 'confirmed') summary.replay.confirmed++
      continue
    }

    const { data: lp } = await supabase
      .from('lp_guest_orders')
      .select('id, payment_ref, status')
      .eq('id', ref)
      .maybeSingle()
    if (lp) {
      if (lp.status !== 'pending') continue
      summary.replay.scanned++
      if (await chipStatus(chipId) !== 'paid') continue
      if (!lp.payment_ref) await supabase.from('lp_guest_orders').update({ payment_ref: chipId }).eq('id', ref)
      const r = await confirmLpGuestOrder(supabase, ref)
      if (r === 'confirmed') summary.replay.confirmed++
    }
  }

  await stampHeartbeat(supabase, 'reconcile-payments')
  return Response.json({ ok: true, ...summary })
}
