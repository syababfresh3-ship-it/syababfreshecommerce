export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stampHeartbeat, stampHeartbeatError } from '@/lib/cron-heartbeat'
import { getOpsAlertConfig, queueOpsAlert, opsCronText, opsStockText } from '@/lib/ops-alerts'

// Pemeriksa amaran operasi (lib/ops-alerts) — Vercel cron setiap 15 min (vercel.json).
//  1) Cron senyap: peraturan sama dengan dashboard admin & laporan harian (senyap > 3× selang
//     jangkaan); satu mesej untuk semua job yang baru/masih senyap, ulang setiap 6 jam per job.
//  2) Stok rendah: produk aktif (batch belum luput + variant aktif) ≤ ambang; ulang 24 jam per produk.
// COD menunggu kelulusan & bayaran gagal dihantar terus dari laluan order/webhook, bukan di sini.
// Dilindungi CRON_SECRET (Bearer). Idempoten.
const JOB = 'ops-alerts'
const CRON_REPEAT_MS = 6 * 3600_000
const STOCK_REPEAT_MS = 24 * 3600_000
const MAX_LINES = 15

type Heartbeat = { job: string; last_ok_at: string | null; expected_minutes: number }

async function lastAlertMap(admin: ReturnType<typeof createAdminClient>, keys: string[]): Promise<Map<string, number>> {
  if (!keys.length) return new Map()
  const { data } = await admin.from('app_settings').select('key, value').in('key', keys)
  return new Map(((data ?? []) as { key: string; value: string }[]).map(r => [r.key, new Date(r.value).getTime() || 0]))
}

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const admin = createAdminClient()
  // Seed baris heartbeat dengan selang 15 min (stampHeartbeat tidak mengubah expected_minutes).
  await admin.from('cron_heartbeats').upsert({ job: JOB, expected_minutes: 15 }, { onConflict: 'job', ignoreDuplicates: true })

  try {
    const cfg = await getOpsAlertConfig()
    const out = { enabled: cfg.enabled, cronJobs: [] as string[], stockItems: [] as string[], stockTotal: 0 }
    if (!cfg.enabled) {
      await stampHeartbeat(admin, JOB)
      return NextResponse.json({ ok: true, ...out })
    }
    const now = Date.now()
    const stampedNow = new Date(now).toISOString()

    // ── 1) Cron senyap ──
    if (cfg.kinds.has('cron')) {
      const { data: hb } = await admin.from('cron_heartbeats').select('job, last_ok_at, expected_minutes')
      const stale = ((hb ?? []) as Heartbeat[])
        .filter(h => h.job !== JOB)
        .filter(h => !h.last_ok_at || now - new Date(h.last_ok_at).getTime() > h.expected_minutes * 3 * 60_000)
        .sort((a, b) => a.job.localeCompare(b.job))
      if (stale.length) {
        const keyOf = (job: string) => `ops_alert_last:cron:${job}`
        const last = await lastAlertMap(admin, stale.map(h => keyOf(h.job)))
        const fresh = stale.filter(h => now - (last.get(keyOf(h.job)) ?? 0) >= CRON_REPEAT_MS)
        if (fresh.length) {
          const r = await queueOpsAlert('cron', opsCronText(fresh.map(h => ({ job: h.job, lastOkAt: h.last_ok_at, expectedMinutes: h.expected_minutes }))))
          if (r === 'queued') {
            await admin.from('app_settings').upsert(fresh.map(h => ({ key: keyOf(h.job), value: stampedNow })), { onConflict: 'key' })
            out.cronJobs = fresh.map(h => h.job)
          }
        }
      }
    }

    // ── 2) Stok rendah (kiraan sama dengan lib/daily-summary) ──
    if (cfg.kinds.has('stock')) {
      const [products, stock, variants] = await Promise.all([
        admin.from('products').select('id, name').eq('is_active', true),
        admin.from('product_stock').select('product_id, available_stock'),
        admin.from('product_variants').select('product_id, stock').eq('is_active', true),
      ])
      const batch = new Map<string, number>()
      for (const r of (stock.data ?? []) as { product_id: string; available_stock: number }[]) batch.set(r.product_id, Number(r.available_stock) || 0)
      const vs = new Map<string, number>()
      for (const r of (variants.data ?? []) as { product_id: string; stock: number }[]) vs.set(r.product_id, (vs.get(r.product_id) ?? 0) + (Number(r.stock) || 0))
      const low = ((products.data ?? []) as { id: string; name: string }[])
        .map(p => ({ id: p.id, name: p.name, stock: (batch.get(p.id) ?? 0) + (vs.get(p.id) ?? 0) }))
        .filter(p => p.stock <= cfg.lowStock)
        .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
      if (low.length) {
        const keyOf = (id: string) => `ops_alert_last:stock:${id}`
        const last = await lastAlertMap(admin, low.map(p => keyOf(p.id)))
        const fresh = low.filter(p => now - (last.get(keyOf(p.id)) ?? 0) >= STOCK_REPEAT_MS)
        if (fresh.length) {
          const shown = fresh.slice(0, MAX_LINES)
          const r = await queueOpsAlert('stock', opsStockText(shown, cfg.lowStock, fresh.length - shown.length))
          if (r === 'queued') {
            await admin.from('app_settings').upsert(fresh.map(p => ({ key: keyOf(p.id), value: stampedNow })), { onConflict: 'key' })
            out.stockItems = shown.map(p => p.name)
            out.stockTotal = fresh.length
          }
        }
      }
    }

    await stampHeartbeat(admin, JOB)
    return NextResponse.json({ ok: true, ...out })
  } catch (e) {
    await stampHeartbeatError(admin, JOB, e)
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}
