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
  // Metrik leads iklan (migration 135) — null untuk baris manual / sebelum migration
  clicks?: number | null
  conversations?: number | null   // perbualan WhatsApp bermula (leads CTWA)
  replies?: number | null
  depth2?: number | null
}

export interface RoasOrder {
  page_id?: string | null
  source: string | null
  total: number | string | null
  status: string
  payment_status?: string | null
}

const ACTIVE = new Set(['confirmed', 'preparing', 'delivering', 'delivered'])

// ── Padanan sumber manual → kempen ─────────────────────────────────────────
// Order tanpa id kempen dalam `source` (cth Quick Order staf: "whatsapp-Pika") boleh
// dipautkan ke kempen yang membawanya (cth iklan "Traffic - WhatsApp"). Disimpan
// dalam app_settings `roas_source_aliases` sebagai JSON { "<source>": "<campaign_id>" };
// kunci dibanding tanpa kes. Diurus di page Ad Spend & ROAS.
export const ROAS_ALIASES_KEY = 'roas_source_aliases'
export type SourceAliases = Record<string, string>

export function parseSourceAliases(raw: string | null | undefined): SourceAliases {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    const out: SourceAliases = {}
    for (const [k, v] of Object.entries(obj ?? {})) {
      const key = String(k).trim().toLowerCase(); const cid = String(v ?? '').replace(/\D/g, '')
      if (key && cid.length >= 8) out[key] = cid
    }
    return out
  } catch { return {} }
}

export async function fetchSourceAliases(sb: SB): Promise<SourceAliases> {
  const { data } = await sb.from('app_settings').select('value').eq('key', ROAS_ALIASES_KEY).maybeSingle()
  return parseSourceAliases(data?.value as string | undefined)
}

// "fb/52520982596515" → "52520982596515"; "whatsapp-Muhd" → null (melainkan ada alias)
export function campaignIdFromSource(source: string | null | undefined, aliases?: SourceAliases): string | null {
  if (!source) return null
  const aliased = aliases?.[source.trim().toLowerCase()]
  if (aliased) return aliased
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
  conversations: number      // jumlah leads (perbualan WA bermula) merentas kempen
  byCampaign: {
    campaign_id: string; channel: string; name: string | null; spend: number; revenue: number; orders: number; roas: number | null
    clicks: number; conversations: number; replies: number; depth2: number
    costPerLead: number | null   // spend ÷ perbualan
    leadToOrder: number | null   // order ÷ perbualan (0–1)
  }[]
  unmatchedSpend: number     // spend tanpa campaign_id (tak boleh dipadankan ke order)
}

export function computeRoas(spendRows: AdSpendRow[], orders: RoasOrder[], aliases?: SourceAliases): RoasSummary {
  const byCampaign = new Map<string, { channel: string; name: string | null; spend: number; revenue: number; orders: number; clicks: number; conversations: number; replies: number; depth2: number }>()
  const byChannel: RoasSummary['byChannel'] = {}
  let spend = 0, unmatchedSpend = 0

  for (const r of spendRows) {
    const amt = Number(r.amount) || 0
    spend += amt
    byChannel[r.channel] = byChannel[r.channel] ?? { spend: 0, revenue: 0, orders: 0 }
    byChannel[r.channel].spend += amt
    if (!r.campaign_id) { unmatchedSpend += amt; continue }
    const c = byCampaign.get(r.campaign_id) ?? { channel: r.channel, name: r.campaign_name, spend: 0, revenue: 0, orders: 0, clicks: 0, conversations: 0, replies: 0, depth2: 0 }
    c.spend += amt
    c.clicks += r.clicks ?? 0; c.conversations += r.conversations ?? 0; c.replies += r.replies ?? 0; c.depth2 += r.depth2 ?? 0
    if (!c.name && r.campaign_name) c.name = r.campaign_name
    byCampaign.set(r.campaign_id, c)
  }

  let revenue = 0, orderCount = 0
  for (const o of orders) {
    if (!ACTIVE.has(o.status)) continue
    const cid = campaignIdFromSource(o.source, aliases)
    if (!cid) continue
    const total = Number(o.total) || 0
    // Sumber beralias (cth whatsapp-Pika) ikut saluran kempen yang dipautkan, bukan 'other'
    const viaAlias = !!aliases?.[(o.source ?? '').trim().toLowerCase()]
    const ch = viaAlias ? (byCampaign.get(cid)?.channel ?? 'meta') : channelFromSource(o.source)
    byChannel[ch] = byChannel[ch] ?? { spend: 0, revenue: 0, orders: 0 }
    byChannel[ch].revenue += total
    byChannel[ch].orders += 1
    revenue += total
    orderCount += 1
    const c = byCampaign.get(cid) ?? { channel: ch, name: null, spend: 0, revenue: 0, orders: 0, clicks: 0, conversations: 0, replies: 0, depth2: 0 }
    c.revenue += total
    c.orders += 1
    byCampaign.set(cid, c)
  }

  return {
    spend, revenue, orders: orderCount,
    roas: spend > 0 ? revenue / spend : null,
    cac: orderCount > 0 && spend > 0 ? spend / orderCount : null,
    byChannel,
    conversations: [...byCampaign.values()].reduce((s, c) => s + c.conversations, 0),
    byCampaign: [...byCampaign.entries()]
      .map(([campaign_id, c]) => ({
        campaign_id, ...c,
        roas: c.spend > 0 ? c.revenue / c.spend : null,
        costPerLead: c.conversations > 0 && c.spend > 0 ? c.spend / c.conversations : null,
        leadToOrder: c.conversations > 0 ? c.orders / c.conversations : null,
      }))
      .sort((a, b) => b.spend - a.spend),
    unmatchedSpend,
  }
}

// Spend untuk satu LP: baris dengan lp_slug = slug, plus baris tanpa lp_slug yang
// campaign_id-nya muncul dalam `source` order LP itu (kempen berkongsi antara LP
// dikira penuh pada setiap LP — nota di UI).
export function spendForLp(slug: string, lpOrders: RoasOrder[], spendRows: AdSpendRow[], aliases?: SourceAliases): number {
  const cids = new Set(lpOrders.map(o => campaignIdFromSource(o.source, aliases)).filter((v): v is string => !!v))
  return spendRows.reduce((s, r) => {
    if (r.lp_slug === slug) return s + (Number(r.amount) || 0)
    if (!r.lp_slug && r.campaign_id && cids.has(r.campaign_id)) return s + (Number(r.amount) || 0)
    return s
  }, 0)
}

// Pemuat: [] kalau jadual belum wujud (migration 130 belum jalan)
export async function fetchAdSpend(sb: SB, fromDate?: string, toDate?: string): Promise<AdSpendRow[]> {
  const BASE = 'id, spend_date, channel, campaign_id, campaign_name, lp_slug, amount, notes'
  const run = async (cols: string) => {
    let q = sb.from('ad_spend').select(cols).order('spend_date', { ascending: false })
    if (fromDate) q = q.gte('spend_date', fromDate)
    if (toDate) q = q.lte('spend_date', toDate)
    return q.limit(2000)
  }
  // Lajur metrik (migration 135) — jatuh balik bila belum wujud supaya spend tetap dipapar
  let { data, error } = await run(`${BASE}, clicks, conversations, replies, depth2`)
  if (error && ['42703', 'PGRST204'].includes(error.code ?? '')) ({ data, error } = await run(BASE))
  if (error) return []
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(r => ({ ...r, amount: Number(r.amount) })) as unknown as AdSpendRow[]
}
