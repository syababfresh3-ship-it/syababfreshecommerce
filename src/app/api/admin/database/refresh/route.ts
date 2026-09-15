// ============================================================
// api/admin/database/refresh — "Segarkan sekarang" untuk /admin/database.
//
// Agregat `customers` (order_count, total_spend, product_names, coupon_codes,
// first_order_at…) disegar oleh cron harian. Butang ini bagi staf segarkan
// atas permintaan tanpa tunggu esok. Admin sahaja.
//
// Throttle 2 minit: plan Supabase kita ketat IO, dan refresh membaca SEMUA
// order + lp_guest_orders. Klik berulang tak patut jadi beban DB.
// ============================================================
export const runtime = 'nodejs'
export const maxDuration = 60   // sama dengan cron refresh-customers

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { refreshCustomerAggregates } from '@/lib/customers'

const THROTTLE_MS = 2 * 60_000

export async function POST() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  // updated_at terkini pada customers ≈ bila refresh terakhir berjalan.
  const { data: last } = await supabase!
    .from('customers')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const lastAt = last?.updated_at ? new Date(last.updated_at).getTime() : 0
  const ageMs = Date.now() - lastAt
  if (ageMs < THROTTLE_MS) {
    const waitS = Math.ceil((THROTTLE_MS - ageMs) / 1000)
    return NextResponse.json(
      { error: `Just refreshed. Try again in ${waitS}s.` },
      { status: 429, headers: { 'Retry-After': String(waitS) } },
    )
  }

  const summary = await refreshCustomerAggregates()
  return NextResponse.json({ ok: summary.failed === 0, ...summary })
}
