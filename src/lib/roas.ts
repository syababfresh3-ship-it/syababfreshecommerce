import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// ROAS / CAC — padankan perbelanjaan iklan (ad_spend, migration 130) dengan
// hasil order LP. Order LP bawa `source` seperti "fb/52520982596515",
// "ig/52509979512115", "th/…" — angka di hujung = id kempen/adset Meta.
// Fungsi tulen (boleh diuji) + satu pemuat data.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export interface AdSpendRow {
  id: string
  spend_date: string
  channel: 'meta' | 'tiktok' | 'google' | 'other'
  campaign_id: string | null
  campaign_name: string | null
  lp_slug: string | null
  amount: number
  notes: string | null
}

export interface RoasOrder {
  page_id?: string | null
  source: string | null
  total: number | string | null
  status: string
  payment_status?: string | null
}

const ACTIVE = new Set(['confirmed', 'preparing', 'delivering', 'delivered'])

// "fb/52520982596515" → "52520982596515"; "whatsapp-Muhd" → null
export function campaignIdFromSource(source: string | null | undefined): string | null {
  if (!source) return null
  const m = source.match(/(\d{8,})\s*$/)
  return m ? m[1] : null
}

export function channelFromSource(source: string | null | undefined): 'meta' | 'tiktok' | 'other' {
  if (!source) return 'other'
  if (/^(fb|ig|th|meta)\b/i.test(source)) return 'meta'
  if (/^(tt|tiktok)\b/i.test(source)) return 'tiktok'
  return 'other'
}

export interface RoasSummary {
  spend: number
  revenue: number            // hasil order aktif (confirmed+) yang boleh dipadankan ke kempen berbayar
  orders: number
  roas: number | null        // revenue / spend
  cac: number | null         // spend / orders
  byChannel: Record<string, { spend: number; revenue: number; orders: number }>
  byCampaign: { campaign_id: string; channel: string; name: string | null; spend: number; revenue: number; orders: number; roas: number | null }[]
  unmatchedSpend: number     // spend tanpa campaign_id (tak boleh dipadankan ke order)
}

export function computeRoas(spendRows: AdSpendRow[], orders: RoasOrder[]): RoasSummary {
  const byCampaign = new Map<string, { channel: string; name: string | null; spend: number; revenue: number; orders: number }>()
  const byChannel: RoasSummary['byChannel'] = {}
  let spend = 0, unmatchedSpend = 0

  for (const r of spendRows) {
    const amt = Number(r.amount) || 0
    spend += amt
    byChannel[r.channel] = byChannel[r.channel] ?? { spend: 0, revenue: 0, orders: 0 }
    byChannel[r.channel].spend += amt
    if (!r.campaign_id) { unmatchedSpend += amt; continue }
    const c = byCampaign.get(r.campaign_id) ?? { channel: r.channel, name: r.campaign_name, spend: 0, revenue: 0, orders: 0 }
    c.spend += amt
    if (!c.name && r.campaign_name) c.name = r.campaign_name
    byCampaign.set(r.campaign_id, c)
  }

  let revenue = 0, orderCount = 0
  for (const o of orders) {
    if (!ACTIVE.has(o.status)) continue
    const cid = campaignIdFromSource(o.source)
    if (!cid) continue
    const total = Number(o.total) || 0
    const ch = channelFromSource(o.source)
    byChannel[ch] = byChannel[ch] ?? { spend: 0, revenue: 0, orders: 0 }
    byChannel[ch].revenue += total
    byChannel[ch].orders += 1
    revenue += total
    orderCount += 1
    const c = byCampaign.get(cid) ?? { channel: ch, name: null, spend: 0, revenue: 0, orders: 0 }
    c.revenue += total
    c.orders += 1
    byCampaign.set(cid, c)
  }

  return {
    spend, revenue, orders: orderCount,
    roas: spend > 0 ? revenue / spend : null,
    cac: orderCount > 0 && spend > 0 ? spend / orderCount : null,
    byChannel,
    byCampaign: [...byCampaign.entries()]
      .map(([campaign_id, c]) => ({ campaign_id, ...c, roas: c.spend > 0 ? c.revenue / c.spend : null }))
      .sort((a, b) => b.spend - a.spend),
    unmatchedSpend,
  }
}

// Spend untuk satu LP: baris dengan lp_slug = slug, plus baris tanpa lp_slug yang
// campaign_id-nya muncul dalam `source` order LP itu (kempen berkongsi antara LP
// dikira penuh pada setiap LP — nota di UI).
export function spendForLp(slug: string, lpOrders: RoasOrder[], spendRows: AdSpendRow[]): number {
  const cids = new Set(lpOrders.map(o => campaignIdFromSource(o.source)).filter((v): v is string => !!v))
  return spendRows.reduce((s, r) => {
    if (r.lp_slug === slug) return s + (Number(r.amount) || 0)
    if (!r.lp_slug && r.campaign_id && cids.has(r.campaign_id)) return s + (Number(r.amount) || 0)
    return s
  }, 0)
}

// Pemuat: [] kalau jadual belum wujud (migration 130 belum jalan)
export async function fetchAdSpend(sb: SB, fromDate?: string, toDate?: string): Promise<AdSpendRow[]> {
  let q = sb.from('ad_spend').select('id, spend_date, channel, campaign_id, campaign_name, lp_slug, amount, notes').order('spend_date', { ascending: false })
  if (fromDate) q = q.gte('spend_date', fromDate)
  if (toDate) q = q.lte('spend_date', toDate)
  const { data, error } = await q.limit(2000)
  if (error) return []
  return (data ?? []).map(r => ({ ...r, amount: Number(r.amount) })) as AdSpendRow[]
}
