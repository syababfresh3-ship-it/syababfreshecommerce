export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { StoreLayout } from '@/components/layout/store-layout'
import { redirect } from 'next/navigation'
import { lpPublicUrl } from '@/lib/lp-host'
import { SHOP_ORIGIN } from '@/lib/kurma-host'
import { AffiliateDashboard, type AffDashboardData, type AffAttrRow, type AffWithdrawal } from './affiliate-dashboard'

// Dashboard affiliate — model produk-link (migration 139) + klik/tahan/RPC (migration 165).
// Semua kiraan di sini (service role, RLS dipintas dengan sengaja — data ditapis ikut user.id).
// Tahan ralat: jadual/lajur migration 165 belum ada → senarai kosong, page tetap buka.

const DAY = 86_400_000
const num = (v: unknown) => Number(v) || 0
const sum = (rows: { amount: number }[]) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100

// Awal bulan Malaysia (UTC+8) dalam ms epoch — konsisten di pelayan (UTC) & pelayar.
function klMonthStart(offsetMonths = 0): number {
  const kl = new Date(Date.now() + 8 * 3600_000)
  return Date.UTC(kl.getUTCFullYear(), kl.getUTCMonth() + offsetMonths, 1) - 8 * 3600_000
}
function intSetting(s: Record<string, string>, key: string, dflt: number, min: number, max: number): number {
  const n = parseInt(s[key] ?? '', 10)
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt
}

type Loaded = { ok: true; data: AffDashboardData } | { ok: false; reason: 'login' | 'not_affiliate' }

async function getAffiliateData(): Promise<Loaded> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'login' }

  const db = createAdminClient()
  const now = Date.now()
  const since90 = new Date(now - 90 * DAY).toISOString()

  const [profileRes, settings, attrRes, wdRes, prodRes, lpRes, clickRes] = await Promise.all([
    db.from('profiles').select('full_name, is_affiliate, affiliate_balance, referral_code').eq('id', user.id).single(),
    getAppSettings(),
    db.from('affiliate_attributions').select('*, product:products(name, slug)').eq('affiliate_id', user.id).order('created_at', { ascending: false }).limit(300),
    db.from('affiliate_withdrawals').select('id, amount, bank_name, bank_account, account_name, status, requested_at, processed_at, admin_note').eq('affiliate_id', user.id).order('requested_at', { ascending: false }),
    db.from('products').select('id, slug, name, affiliate_pct, image_url, price').gt('affiliate_pct', 0).eq('is_active', true).eq('show_in_storefront', true).order('name'),
    db.from('landing_pages').select('slug, title, host').eq('is_active', true).order('updated_at', { ascending: false }).limit(40),
    db.from('affiliate_clicks').select('id, scope, product_id, lp_slug, created_at').eq('affiliate_id', user.id).gte('created_at', since90).order('created_at', { ascending: false }).limit(5000),
  ])

  const profile = profileRes.data
  if (!profile?.is_affiliate) return { ok: false, reason: 'not_affiliate' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (attrRes.data ?? []) as any[]
  const attributions: AffAttrRow[] = raw.map(a => ({
    id: a.id,
    source: a.order_source === 'lp_guest' ? 'lp_guest' : 'order',
    orderNumber: a.order_number ?? null,
    lpSlug: a.lp_slug ?? null,
    productId: a.product_id ?? null,
    productName: a.product?.name ?? 'Produk',
    productSlug: a.product?.slug ?? null,
    gross: num(a.line_gross ?? a.line_subtotal),
    net: num(a.line_subtotal),
    rate: num(a.rate),
    amount: num(a.amount),
    status: a.status === 'credited' ? 'credited' : a.status === 'reversed' ? 'reversed' : 'pending',
    createdAt: a.created_at,
    creditAfter: a.credit_after ?? null,
    creditedAt: a.credited_at ?? null,
    reversedAt: a.reversed_at ?? null,
    reversedReason: a.reversed_reason ?? null,
  }))
  const orderKey = new Map(raw.map(a => [a.id as string, `${a.order_source}:${a.order_id}`]))

  const live = attributions.filter(a => a.status !== 'reversed')
  const credited = attributions.filter(a => a.status === 'credited')
  const thisStart = klMonthStart(0)
  const lastStart = klMonthStart(-1)
  const tOf = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)

  const clicks = (clickRes.data ?? []) as { id: string; scope: string | null; product_id: string | null; lp_slug: string | null; created_at: string }[]
  const since30ms = now - 30 * DAY
  const distinctOrders = (rows: AffAttrRow[]) => new Set(rows.map(a => orderKey.get(a.id) ?? a.id)).size

  const withdrawals = (wdRes.data ?? []) as AffWithdrawal[]

  const products = (prodRes.data ?? []).map(p => {
    const mine = live.filter(a => a.productId === p.id)
    return {
      slug: p.slug as string, name: p.name as string, pct: num(p.affiliate_pct), imageUrl: (p.image_url as string | null) ?? null, price: num(p.price),
      clicks: clicks.filter(c => c.product_id === p.id || c.scope === p.slug).length,
      orders: distinctOrders(mine),
      amount: sum(mine),
    }
  })
  const lps = (lpRes.data ?? []).map(l => {
    const mine = live.filter(a => a.lpSlug === l.slug)
    return {
      slug: l.slug as string, title: (l.title as string) || l.slug, url: lpPublicUrl(l.slug, l.host),
      clicks: clicks.filter(c => c.lp_slug === l.slug).length,
      orders: distinctOrders(mine),
      amount: sum(mine),
    }
  })

  return {
    ok: true,
    data: {
      name: profile.full_name ?? null,
      code: String(profile.referral_code ?? ''),
      balance: num(profile.affiliate_balance),
      holdDays: intSetting(settings, 'affiliate_hold_days', 7, 0, 60),
      windowDays: intSetting(settings, 'affiliate_window_days', 30, 1, 365),
      minWithdraw: Math.max(1, Number(settings['affiliate_min_withdraw'] ?? 10) || 10),
      pendingTotal: sum(attributions.filter(a => a.status === 'pending')),
      creditedTotal: sum(credited),
      withdrawnPaid: Math.round(withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + num(w.amount), 0) * 100) / 100,
      thisMonth: sum(credited.filter(a => tOf(a.creditedAt) >= thisStart)),
      lastMonth: sum(credited.filter(a => tOf(a.creditedAt) >= lastStart && tOf(a.creditedAt) < thisStart)),
      clicks30: clicks.filter(c => tOf(c.created_at) >= since30ms).length,
      orders30: distinctOrders(live.filter(a => tOf(a.createdAt) >= since30ms)),
      hasPendingWithdrawal: withdrawals.some(w => w.status === 'pending' || w.status === 'approved'),
      attributions,
      withdrawals,
      products,
      lps,
      shopOrigin: SHOP_ORIGIN,
      nowMs: now,
    },
  }
}

export default async function AffiliatePage() {
  const res = await getAffiliateData()
  if (!res.ok) redirect(res.reason === 'login' ? '/login?redirect=/affiliate' : '/loyalty')
  return (
    <StoreLayout>
      <AffiliateDashboard data={res.data} />
    </StoreLayout>
  )
}
