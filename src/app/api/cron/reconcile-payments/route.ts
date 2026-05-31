export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { confirmLpGuestOrder, confirmStorefrontOrder } from '@/lib/order-confirm'

export const runtime = 'nodejs'

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'
const FAILED_STATUSES = ['error', 'cancelled', 'expired']

// Safety net for CHIP payments the webhook + browser fallback both missed.
// Polls CHIP for every still-pending online order that has a stored purchase id
// and reconciles it: paid → confirm (+ notify), failed/expired → cancel.
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
    lp: { checked: 0, confirmed: 0, cancelled: 0 },
    storefront: { checked: 0, confirmed: 0, cancelled: 0 },
  }

  // ── LP guest orders ────────────────────────────────────────────────
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

  // ── Storefront orders ──────────────────────────────────────────────
  const { data: ordRows } = await supabase
    .from('orders')
    .select('id, payment_ref')
    .eq('payment_status', 'unpaid')
    .in('payment_method', ['fpx', 'ewallet', 'online'])
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

  return Response.json({ ok: true, ...summary })
}
