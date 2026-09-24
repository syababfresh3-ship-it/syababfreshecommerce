// ============================================================
// api/cron/meta-ad-spend — tarik spend Meta ikut kempen (harian) → ad_spend.
// Dipanggil cron-job.org harian. Bearer CRON_SECRET.
//
// Kenapa: tab Performance LP & page Ad Spend & ROAS dah tahu kira ROAS/CAC dari
// jadual ad_spend (migration 130), tetapi jadual itu kosong — tiada yang mengisi.
// Cron ini mengisinya dari Graph API (lib/meta-ads.ts) supaya kos setiap kempen
// nampak tanpa entri manual.
//
// ?days=N  — julat N hari terakhir (default 7 — Meta kadang betulkan angka
//            beberapa hari kemudian; maks 90 untuk backfill)
// ?dry=1   — tarik & pulangkan ringkasan sahaja, TIADA tulisan
//
// Peraturan tulis (channel 'meta', baris ber-campaign_id sahaja):
//   • baris (tarikh, kempen) dah ada       → kemas kini amount/nama, tanda notes 'auto:meta'
//   • belum ada                            → sisip
//   • baris 'auto:meta' yang Meta tak lagi pulangkan (spend jadi 0) → padam
//   Baris manual (notes lain / tanpa campaign_id) tak disentuh melainkan Meta ada
//   angka untuk (tarikh, kempen) yang sama — angka API mengatasi angka manual.
// ============================================================
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

import { createAdminClient } from '@/lib/supabase/admin'
import { stampHeartbeat, stampHeartbeatError } from '@/lib/cron-heartbeat'
import { fetchMetaCampaignSpend, metaAdsConfigured } from '@/lib/meta-ads'

const JOB = 'meta-ad-spend'
export const AUTO_NOTE = 'auto:meta'
// Lajur metrik leads (migration 135). Bila belum wujud (42703 / PGRST204) → tulis tanpa metrik.
const METRIC_COLS = ['clicks', 'conversations', 'replies', 'depth2'] as const
const MISSING_COLUMN = new Set(['42703', 'PGRST204'])
function stripMetrics<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  const c: Record<string, unknown> = { ...o }
  for (const k of METRIC_COLS) delete c[k]
  return c
}

function mytDate(offsetDays = 0): string {
  return new Date(Date.now() + 8 * 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const sp = new URL(req.url).searchParams
  const days = Math.min(90, Math.max(1, parseInt(sp.get('days') ?? '7', 10) || 7))
  const dry = sp.get('dry') === '1'
  const until = mytDate(0)
  const since = mytDate(days - 1)
  const sb = createAdminClient()

  if (!metaAdsConfigured()) {
    await stampHeartbeatError(sb, JOB, 'META_ADS_ACCESS_TOKEN / META_ADS_ACCOUNT_IDS tidak diset')
    return Response.json({ ok: false, error: 'META_ADS_ACCESS_TOKEN / META_ADS_ACCOUNT_IDS tidak diset' }, { status: 503 })
  }

  const meta = await fetchMetaCampaignSpend(since, until)
  const byCampaign = new Map<string, { name: string; amount: number; days: number; clicks: number; conversations: number }>()
  for (const r of meta.rows) {
    const c = byCampaign.get(r.campaign_id) ?? { name: r.campaign_name, amount: 0, days: 0, clicks: 0, conversations: 0 }
    c.amount += r.amount; c.days += 1; c.clicks += r.clicks; c.conversations += r.conversations
    byCampaign.set(r.campaign_id, c)
  }
  const total = Math.round(meta.rows.reduce((s, r) => s + r.amount, 0) * 100) / 100
  const campaigns = [...byCampaign.entries()]
    .map(([campaign_id, c]) => ({ campaign_id, ...c, amount: Math.round(c.amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  if (!meta.ok && meta.rows.length === 0) {
    await stampHeartbeatError(sb, JOB, meta.errors.join('; '))
    return Response.json({ ok: false, since, until, errors: meta.errors }, { status: 502 })
  }
  if (dry) return Response.json({ ok: meta.ok, dry: true, since, until, accounts: meta.accounts, fetched: meta.rows.length, total, campaigns, errors: meta.errors })

  // ── Sync ke ad_spend ──────────────────────────────────────────────────────
  const { data: existing, error: exErr } = await sb
    .from('ad_spend')
    .select('id, spend_date, campaign_id, amount, campaign_name, notes, clicks, conversations, replies, depth2')
    .eq('channel', 'meta')
    .gte('spend_date', since)
    .lte('spend_date', until)
    .not('campaign_id', 'is', null)
  let metricsOk = true
  type ExRow = { id: string; spend_date: string; campaign_id: string | null; amount: number; campaign_name: string | null; notes: string | null; clicks?: number | null; conversations?: number | null; replies?: number | null; depth2?: number | null }
  let rowsEx: ExRow[] = (existing ?? []) as ExRow[]
  if (exErr) {
    if (!MISSING_COLUMN.has(exErr.code ?? '')) {
      await stampHeartbeatError(sb, JOB, exErr.message)
      return Response.json({ ok: false, error: exErr.message }, { status: 500 })
    }
    // Migration 135 belum jalan → tanpa metrik
    metricsOk = false
    const again = await sb.from('ad_spend').select('id, spend_date, campaign_id, amount, campaign_name, notes')
      .eq('channel', 'meta').gte('spend_date', since).lte('spend_date', until).not('campaign_id', 'is', null)
    if (again.error) {
      await stampHeartbeatError(sb, JOB, again.error.message)
      return Response.json({ ok: false, error: again.error.message }, { status: 500 })
    }
    rowsEx = (again.data ?? []) as ExRow[]
  }
  const byKey = new Map(rowsEx.map(r => [`${r.spend_date}|${r.campaign_id}`, r]))

  let inserted = 0, updated = 0, removed = 0
  const toInsert: Record<string, unknown>[] = []
  const now = new Date().toISOString()
  for (const r of meta.rows) {
    const key = `${r.spend_date}|${r.campaign_id}`
    const ex = byKey.get(key)
    if (ex) {
      byKey.delete(key) // dilihat — jangan padam
      const sameMetrics = !metricsOk || (ex.clicks === r.clicks && ex.conversations === r.conversations && ex.replies === r.replies && ex.depth2 === r.depth2)
      const same = Number(ex.amount) === r.amount && ex.campaign_name === r.campaign_name && ex.notes === AUTO_NOTE && sameMetrics
      if (!same) {
        const full = { amount: r.amount, campaign_name: r.campaign_name || ex.campaign_name, notes: AUTO_NOTE, updated_at: now, clicks: r.clicks, conversations: r.conversations, replies: r.replies, depth2: r.depth2 }
        const { error } = await sb.from('ad_spend').update(metricsOk ? full : stripMetrics(full)).eq('id', ex.id)
        if (!error) updated++
      }
    } else {
      toInsert.push({ spend_date: r.spend_date, channel: 'meta', campaign_id: r.campaign_id, campaign_name: r.campaign_name || null, amount: r.amount, notes: AUTO_NOTE, clicks: r.clicks, conversations: r.conversations, replies: r.replies, depth2: r.depth2 })
    }
  }
  if (toInsert.length) {
    let { error } = await sb.from('ad_spend').insert(metricsOk ? toInsert : toInsert.map(stripMetrics))
    if (error && metricsOk && MISSING_COLUMN.has(error.code ?? '')) {
      metricsOk = false
      ;({ error } = await sb.from('ad_spend').insert(toInsert.map(stripMetrics)))
    }
    if (error) {
      await stampHeartbeatError(sb, JOB, error.message)
      return Response.json({ ok: false, error: error.message, since, until }, { status: 500 })
    }
    inserted = toInsert.length
  }
  // Baris auto yang Meta tak lagi pulangkan dalam julat ini (spend 0 / kempen dipadam)
  const stale = [...byKey.values()].filter(r => r.notes === AUTO_NOTE).map(r => r.id)
  if (stale.length) {
    const { error } = await sb.from('ad_spend').delete().in('id', stale)
    if (!error) removed = stale.length
  }

  await stampHeartbeat(sb, JOB)
  return Response.json({ ok: meta.ok, since, until, accounts: meta.accounts, fetched: meta.rows.length, inserted, updated, removed, total, metrics: metricsOk ? 'saved' : 'skipped (migration 135 belum jalan)', campaigns, errors: meta.errors })
}
