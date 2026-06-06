export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, isValidPhone } from '@/lib/phone'
import { WaBlastClient, type BlastRow } from './wa-blast-client'

// Bina link tracking yang boleh dihantar ke pelanggan:
//  1) tracking_url tersurat (Lalamove direct link / auto-isi dari template) — guna terus
//  2) ada tracking_number + template kurier → isikan {number}
//  3) fallback → tracking_number mentah (lebih baik daripada kosong)
function buildTrackingLink(
  carrierId: string | null,
  trackingNumber: string | null,
  trackingUrl: string | null,
  carrierTemplates: Map<string, string | null>,
): string {
  if (trackingUrl) return trackingUrl
  if (trackingNumber) {
    const tmpl = carrierId ? carrierTemplates.get(carrierId) : null
    if (tmpl) return tmpl.replace('{number}', trackingNumber)
    return trackingNumber
  }
  return ''
}

// Hanya 7 hari terakhir — blast dibuat setiap hari lepas penghantaran, jadi tak perlu
// muat semua order delivering (yang lama dah diblast). Tapis ikut delivering_at
// (fallback created_at untuk rekod lama yg delivering_at null).
const WINDOW_DAYS = 7

async function getDeliveringRows(): Promise<BlastRow[]> {
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()
  const recentFilter = `delivering_at.gte.${cutoff},and(delivering_at.is.null,created_at.gte.${cutoff})`

  // Kurier → template URL (untuk isi tracking link bila hanya nombor disimpan)
  const { data: carriers } = await admin
    .from('shipping_carriers')
    .select('id, tracking_url_template')
  const carrierTemplates = new Map<string, string | null>(
    (carriers ?? []).map((c) => [c.id, c.tracking_url_template]),
  )

  // ── Sumber 1: order pelanggan berdaftar (orders + profiles + order_shipments) ──
  const { data: regOrders } = await admin
    .from('orders')
    .select('id, order_number, user_id, created_at, delivering_at, wa_blasted_at')
    .eq('status', 'delivering')
    .or(recentFilter)
    .order('created_at', { ascending: false })

  const regRows: BlastRow[] = []
  if (regOrders && regOrders.length > 0) {
    const orderIds = regOrders.map((o) => o.id)
    const userIds = [...new Set(regOrders.map((o) => o.user_id).filter(Boolean))]

    const [{ data: profiles }, { data: shipments }] = await Promise.all([
      admin.from('profiles').select('id, full_name, phone').in('id', userIds),
      admin
        .from('order_shipments')
        .select('order_id, carrier_id, tracking_number, tracking_url')
        .in('order_id', orderIds),
    ])

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const shipMap = new Map((shipments ?? []).map((s) => [s.order_id, s]))

    for (const o of regOrders) {
      const p = o.user_id ? profileMap.get(o.user_id) : undefined
      const s = shipMap.get(o.id)
      regRows.push({
        source: 'shop',
        name: p?.full_name ?? '',
        phone: normalizePhone(p?.phone),
        order_number: o.order_number,
        carrier: s?.carrier_id ?? '',
        tracking: buildTrackingLink(s?.carrier_id ?? null, s?.tracking_number ?? null, s?.tracking_url ?? null, carrierTemplates),
        date: o.delivering_at ?? o.created_at,
        blasted_at: o.wa_blasted_at ?? null,
      })
    }
  }

  // ── Sumber 2: order guest / landing page (lp_guest_orders) ──
  const { data: lpOrders } = await admin
    .from('lp_guest_orders')
    .select('order_number, name, phone, courier_id, tracking_number, tracking_url, created_at, delivering_at, wa_blasted_at')
    .eq('status', 'delivering')
    .or(recentFilter)
    .order('created_at', { ascending: false })

  const lpRows: BlastRow[] = (lpOrders ?? []).map((o) => ({
    source: 'lp',
    name: o.name ?? '',
    phone: normalizePhone(o.phone),
    order_number: o.order_number,
    carrier: o.courier_id ?? '',
    tracking: buildTrackingLink(o.courier_id, o.tracking_number, o.tracking_url, carrierTemplates),
    date: o.delivering_at ?? o.created_at,
    blasted_at: o.wa_blasted_at ?? null,
  }))

  return [...regRows, ...lpRows]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((r) => ({ ...r, phone_valid: isValidPhone(r.phone) }))
}

export default async function WaBlastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/admin')

  const rows = await getDeliveringRows()
  return <WaBlastClient rows={rows} />
}
