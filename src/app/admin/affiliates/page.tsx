export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { AffiliatesClient, type AdminAffData, type AdminAffAttr } from './affiliates-client'

// Admin → Affiliate. Model produk-link (migration 139) + klik/tahan/RPC (migration 165).
// Tahan ralat: jadual/lajur migration 165 belum ada → senarai kosong, page tetap buka.

const DAY = 86_400_000
const num = (v: unknown) => Number(v) || 0

async function getData(): Promise<AdminAffData> {
  const sb = createAdminClient()
  const since30 = new Date(Date.now() - 30 * DAY).toISOString()

  const [profilesRes, wdRes, settings, appsRes, attrRes, clicksRes] = await Promise.all([
    sb.from('profiles')
      .select('id, full_name, email, phone, is_affiliate, affiliate_balance, referral_code, created_at')
      .eq('is_admin', false)
      .order('created_at', { ascending: false }),
    sb.from('affiliate_withdrawals')
      .select('*, affiliate:profiles!affiliate_withdrawals_affiliate_id_fkey(full_name, email, phone)')
      .order('requested_at', { ascending: false })
      .limit(300),
    getAppSettings(),
    sb.from('affiliate_applications')
      .select('id, user_id, status, message, admin_note, created_at, applicant:profiles!affiliate_applications_user_id_fkey(full_name, email, phone)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    sb.from('affiliate_attributions')
      .select('*, affiliate:profiles!affiliate_attributions_affiliate_id_fkey(full_name, email), product:products(name, slug)')
      .order('created_at', { ascending: false })
      .limit(1000),
    sb.from('affiliate_clicks').select('affiliate_id, created_at').gte('created_at', since30).limit(20000),
  ])

  const clicks30ByAff: Record<string, number> = {}
  for (const c of (clicksRes.data ?? []) as { affiliate_id: string }[]) clicks30ByAff[c.affiliate_id] = (clicks30ByAff[c.affiliate_id] ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attributions: AdminAffAttr[] = ((attrRes.data ?? []) as any[]).map(a => ({
    id: a.id,
    affiliateId: a.affiliate_id,
    affiliateName: a.affiliate?.full_name ?? null,
    affiliateEmail: a.affiliate?.email ?? null,
    source: a.order_source === 'lp_guest' ? 'lp_guest' : 'order',
    orderId: a.order_id,
    orderNumber: a.order_number ?? null,
    lpSlug: a.lp_slug ?? null,
    productName: a.product?.name ?? '—',
    gross: num(a.line_gross ?? a.line_subtotal),
    net: num(a.line_subtotal),
    rate: num(a.rate),
    amount: num(a.amount),
    status: a.status === 'credited' ? 'credited' : a.status === 'reversed' ? 'reversed' : 'pending',
    createdAt: a.created_at,
    clickedAt: a.clicked_at ?? null,
    creditAfter: a.credit_after ?? null,
    creditedAt: a.credited_at ?? null,
    reversedReason: a.reversed_reason ?? null,
  }))

  const int = (key: string, dflt: number) => { const n = parseInt(settings[key] ?? '', 10); return Number.isFinite(n) ? n : dflt }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profiles: (profilesRes.data ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withdrawals: (wdRes.data ?? []) as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applications: (appsRes.data ?? []) as any[],
    attributions,
    clicks30ByAff,
    settings: {
      holdDays: int('affiliate_hold_days', 7),
      windowDays: int('affiliate_window_days', 30),
      minWithdraw: num(settings['affiliate_min_withdraw']) || 10,
      notifyWa: settings['affiliate_notify_wa'] === 'on',
    },
  }
}

export default async function AdminAffiliatesPage() {
  const data = await getData()
  return <AffiliatesClient data={data} />
}
