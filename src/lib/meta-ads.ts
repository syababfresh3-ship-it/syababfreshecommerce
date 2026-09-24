// ============================================================
// meta-ads — tarik perbelanjaan iklan Meta (FB/IG/Threads) ikut KEMPEN, harian.
// BACA SAHAJA (Graph API insights, level=campaign, time_increment=1).
//
// Dipakai cron /api/cron/meta-ad-spend → jadual ad_spend (migration 130) →
// tab Performance LP, page Ad Spend & ROAS, P&L. Order LP bawa id kempen dalam
// `source` ("fb/<campaign_id>" dari utm_campaign) — jadi spend ikut kempen
// terus boleh dipadankan dengan hasil (lib/roas.ts).
//
// Cermin corak syababfresh-app lib/meta/adsSpend.ts (yang tarik peringkat AKAUN,
// bulanan, untuk KPI). Di sini peringkat KEMPEN, harian, untuk ROAS.
//
// Env: META_ADS_ACCESS_TOKEN  — token System User dengan izin ads_read
//      META_ADS_ACCOUNT_IDS   — "act_123,act_456"
//      META_GRAPH_VERSION     — pilihan, default v21.0
// ============================================================

const TOKEN = process.env.META_ADS_ACCESS_TOKEN ?? ''
const ACCOUNT_IDS = (process.env.META_ADS_ACCOUNT_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
const VERSION = process.env.META_GRAPH_VERSION ?? 'v21.0'
const BASE = `https://graph.facebook.com/${VERSION}`
const TIMEOUT_MS = 25_000
const MAX_PAGES = 20

export interface MetaCampaignDay {
  spend_date: string     // YYYY-MM-DD (zon masa akaun iklan)
  account_id: string
  campaign_id: string
  campaign_name: string
  amount: number         // MYR
  impressions: number
  clicks: number         // inline_link_clicks
  conversations: number  // perbualan WhatsApp bermula (leads iklan CTWA)
  replies: number        // balasan pertama
  depth2: number         // pelanggan hantar ≥2 mesej
}

export interface MetaSpendResult {
  ok: boolean            // semua akaun berjaya
  rows: MetaCampaignDay[]
  accounts: string[]
  errors: string[]
}

export function metaAdsConfigured(): boolean {
  return !!TOKEN && ACCOUNT_IDS.length > 0
}

type InsightRow = {
  date_start?: string; campaign_id?: string; campaign_name?: string
  spend?: string; impressions?: string; inline_link_clicks?: string
  actions?: { action_type: string; value: string }[]
}
const ACT_CONV = 'onsite_conversion.messaging_conversation_started_7d'
const ACT_REPLY = 'onsite_conversion.messaging_first_reply'
const ACT_DEPTH2 = 'onsite_conversion.messaging_user_depth_2_message_send'
const act = (r: InsightRow, type: string) => Number((r.actions ?? []).find(a => a.action_type === type)?.value ?? 0) || 0
type InsightPage = { data?: InsightRow[]; paging?: { next?: string }; error?: { message?: string; code?: number } }

async function getJson(url: string): Promise<InsightPage> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    const json = (await res.json().catch(() => ({}))) as InsightPage
    if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
    return json
  } finally {
    clearTimeout(timer)
  }
}

/** Spend harian ikut kempen untuk julat [since, until] (YYYY-MM-DD, inklusif). */
export async function fetchMetaCampaignSpend(since: string, until: string): Promise<MetaSpendResult> {
  const rows: MetaCampaignDay[] = []
  const errors: string[] = []
  if (!metaAdsConfigured()) return { ok: false, rows, accounts: ACCOUNT_IDS, errors: ['META_ADS_ACCESS_TOKEN / META_ADS_ACCOUNT_IDS tidak diset'] }

  for (const acct of ACCOUNT_IDS) {
    const first = new URL(`${BASE}/${acct}/insights`)
    first.searchParams.set('level', 'campaign')
    first.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions')
    first.searchParams.set('time_range', JSON.stringify({ since, until }))
    first.searchParams.set('time_increment', '1')
    first.searchParams.set('limit', '500')
    first.searchParams.set('access_token', TOKEN)

    let url: string | undefined = first.toString()
    let pages = 0
    try {
      while (url && pages < MAX_PAGES) {
        const page: InsightPage = await getJson(url)
        for (const r of page.data ?? []) {
          const amount = Math.round((Number(r.spend) || 0) * 100) / 100
          const conversations = act(r, ACT_CONV)
          if (!r.campaign_id || !r.date_start || (amount <= 0 && conversations <= 0)) continue
          rows.push({
            spend_date: r.date_start,
            account_id: acct,
            campaign_id: r.campaign_id,
            campaign_name: (r.campaign_name ?? '').slice(0, 200),
            amount,
            impressions: Number(r.impressions) || 0,
            clicks: Number(r.inline_link_clicks) || 0,
            conversations,
            replies: act(r, ACT_REPLY),
            depth2: act(r, ACT_DEPTH2),
          })
        }
        url = page.paging?.next
        pages++
      }
    } catch (err) {
      errors.push(`${acct}: ${(err as Error).message}`)
    }
  }
  return { ok: errors.length === 0, rows, accounts: ACCOUNT_IDS, errors }
}
