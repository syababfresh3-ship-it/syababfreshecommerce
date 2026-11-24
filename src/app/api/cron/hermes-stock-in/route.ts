export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stampHeartbeat, stampHeartbeatError } from '@/lib/cron-heartbeat'
import { getOpsAlertConfig, queueOpsAlert } from '@/lib/ops-alerts'
import { fetchHermesCsv, parseHermesRows, groupByInvoice, stockInMessage } from '@/lib/hermes-sheet'
import { setAgentStatus } from '@/lib/office'

// Pemantau "buah baru masuk" — sheet Hermes (log invois pembekal) disemak setiap 10 min (vercel.json).
// Baris baharu (kunci belum dilihat) dikumpul ikut invois → satu mesej WhatsApp ke kumpulan staf melalui
// nombor gateway (lib/ops-alerts, jenis 'stock_in'). Baris yang sudah dilihat disimpan di app_settings
// `hermes_stock_in_seen` (JSON, dipotong kepada 1500 kunci terkini).
// LARIAN PERTAMA = garis dasar: tanda semua baris sedia ada tanpa hantar apa-apa (elak banjir 700+ baris).
// `?reset=1` bersama token → bina semula garis dasar. Dilindungi CRON_SECRET (Bearer). Idempoten.
const JOB = 'hermes-stock-in'
const SEEN_KEY = 'hermes_stock_in_seen'
const KEEP = 1500

type Seen = { keys: string[]; baselined_at?: string; updated_at?: string }

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const admin = createAdminClient()
  // Pejabat AI: Nurul sedang menjalankan tugasan ini (lib/office) — best-effort.
  await setAgentStatus(admin, { agent: 'nurul', state: 'working', task: 'Semak sheet Hermes untuk buah baru masuk' })
  await admin.from('cron_heartbeats').upsert({ job: JOB, expected_minutes: 10 }, { onConflict: 'job', ignoreDuplicates: true })
  const reset = new URL(req.url).searchParams.get('reset') === '1'

  try {
    const { header, rows: raw } = await fetchHermesCsv()
    const rows = parseHermesRows(header, raw)
    const nowIso = new Date().toISOString()

    const { data: seenRow } = await admin.from('app_settings').select('value').eq('key', SEEN_KEY).maybeSingle()
    let seen: Seen | null = null
    if (seenRow?.value && !reset) { try { seen = JSON.parse(String(seenRow.value)) as Seen } catch { seen = null } }

    const save = async (keys: string[], extra: Partial<Seen> = {}) => {
      const trimmed = keys.slice(-KEEP)
      await admin.from('app_settings').upsert({ key: SEEN_KEY, value: JSON.stringify({ ...(seen ?? {}), ...extra, keys: trimmed, updated_at: nowIso }), updated_at: nowIso }, { onConflict: 'key' })
    }

    // Garis dasar (pertama kali / reset): semua baris semasa dianggap sudah dilihat.
    if (!seen || !Array.isArray(seen.keys)) {
      await save(rows.map(r => r.key), { baselined_at: nowIso })
      await stampHeartbeat(admin, JOB)
    await setAgentStatus(admin, { agent: 'nurul', state: 'idle', task: 'Siap: Semak sheet Hermes untuk buah baru masuk' })
      return NextResponse.json({ ok: true, baseline: true, rows: rows.length })
    }

    const seenSet = new Set(seen.keys)
    const fresh = rows.filter(r => !seenSet.has(r.key))
    const out = { ok: true, rows: rows.length, fresh: fresh.length, invoices: 0, queued: 0, skipped: 0, enabled: false }

    if (fresh.length) {
      const cfg = await getOpsAlertConfig()
      out.enabled = cfg.enabled && cfg.kinds.has('stock_in')
      const groups = groupByInvoice(fresh)
      out.invoices = groups.length
      for (const g of groups) {
        const r = await queueOpsAlert('stock_in', stockInMessage(g, cfg.stockInCost), { dedupeKey: `inv:${g.groupKey}`, repeatMs: 7 * 86_400_000 })
        if (r === 'queued') out.queued++
        else if (r === 'skipped') out.skipped++
      }
      // Tanda sebagai dilihat walau amaran dimatikan — supaya bila dihidupkan nanti tak banjir baris lama.
      await save([...seen.keys, ...fresh.map(r => r.key)])
    }

    await stampHeartbeat(admin, JOB)
    await setAgentStatus(admin, { agent: 'nurul', state: 'idle', task: 'Siap: Semak sheet Hermes untuk buah baru masuk' })
    return NextResponse.json(out)
  } catch (e) {
    await stampHeartbeatError(admin, JOB, e)
    await setAgentStatus(admin, { agent: 'nurul', state: 'idle', task: 'Gagal: Semak sheet Hermes untuk buah baru masuk' })
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}
