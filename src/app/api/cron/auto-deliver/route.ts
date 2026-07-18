export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { createAdminClient } from '@/lib/supabase/admin'
import { handleOrderDelivered } from '@/lib/order-delivered'
import { awardLpLoyalty } from '@/lib/lp-loyalty'
import { stampHeartbeat } from '@/lib/cron-heartbeat'

// Auto-mark order 'delivering' → 'delivered' selepas 7 hari, sebab tiada sync
// status dari courier (Ninja/Pos/Lalamove). Tanpa ini, order tersangkut di
// 'delivering' selamanya & mata loyalty/referral/affiliate tak pernah dikredit.
//
// Heuristik kasar tapi selamat: anggap dah sampai lepas seminggu.
//   • Storefront (orders) & LP (lp_guest_orders): guna delivering_at (diset masa
//     transisi → delivering; lihat migration 070 untuk LP).
//
// Side-effect (handleOrderDelivered / awardLpLoyalty) semua idempotent. Dipanggil
// cron-job.org harian. Cap per-run supaya siap bawah timeout 30s; backlog awal
// dihabiskan beberapa hari. Dilindungi CRON_SECRET (Bearer).
//
// Ambang hari boleh laras dari URL: ?days=N (1–60). Default 7 (webhook delivered
// Ninja/Poslaju/Lalamove kini auto-sync majoriti; ambang ini cuma jaring keselamatan
// untuk yang terlepas). NOTA: jika URL cron-job.org ada ?days=N, ia OVERRIDE default ni.

const DEFAULT_DAYS = 7
const LIMIT = 40 // per jadual setiap run — kekal bawah timeout

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const daysParam = parseInt(new URL(req.url).searchParams.get('days') ?? '', 10)
  const CUTOFF_DAYS = Number.isFinite(daysParam) && daysParam >= 1 && daysParam <= 60 ? daysParam : DEFAULT_DAYS

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const cutoff = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let sfDelivered = 0
  let lpDelivered = 0

  // ── Storefront orders ────────────────────────────────────────────────
  const { data: sf } = await admin
    .from('orders')
    .select('id')
    .eq('status', 'delivering')
    .lte('delivering_at', cutoff)
    .limit(LIMIT)

  for (const o of sf ?? []) {
    const { data: synced } = await admin
      .from('orders')
      .update({ status: 'delivered', delivered_at: now })
      .eq('id', o.id)
      .eq('status', 'delivering') // guard race
      .select('id')
    if (synced?.length) {
      await handleOrderDelivered(admin, o.id) // loyalty + referral + affiliate (idempotent)
      sfDelivered++
    }
  }

  // ── LP guest orders ──────────────────────────────────────────────────
  const { data: lp } = await admin
    .from('lp_guest_orders')
    .select('id, order_number, phone, total, payment_method, payment_status, user_id, source')
    .eq('status', 'delivering')
    .lte('delivering_at', cutoff)
    .limit(LIMIT)

  for (const o of lp ?? []) {
    const { data: synced } = await admin
      .from('lp_guest_orders')
      .update({ status: 'delivered', delivered_at: now, updated_at: now })
      .eq('id', o.id)
      .eq('status', 'delivering') // guard race
      .select('id')
    if (synced?.length) {
      await awardLpLoyalty(admin, o).catch(() => {}) // idempotent (loyalty_awarded flag)
      lpDelivered++
    }
  }

  console.log(`[auto-deliver] storefront ${sfDelivered}, lp ${lpDelivered} (days=${CUTOFF_DAYS}, cutoff ${cutoff})`)
  await stampHeartbeat(admin, 'auto-deliver')
  return Response.json({ ok: true, days: CUTOFF_DAYS, sfDelivered, lpDelivered, cutoff })
}
