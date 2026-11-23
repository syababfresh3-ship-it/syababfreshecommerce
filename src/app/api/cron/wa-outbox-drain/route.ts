import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'
import { stampHeartbeat } from '@/lib/cron-heartbeat'
import { gatewaySendText } from '@/lib/wa-gateway'
import { gatewayFailureAction, nextWindowStart, finalizeGatewayBlast } from '@/lib/blast-gateway'

// Drainer wa_outbox. Dipanggil scheduler luar (cron-job.org ~tiap 5 min) sebab
// Vercel Hobby cron hanya sekali/hari. Ambil mesej 'pending' yg scheduled_at <= now,
// hantar guna sendWhatsApp (rotate session + failover), tanda sent/failed.
//
// Pacing sebenar dibuat masa ENQUEUE (scheduled_at berperingkat 30–90s). Di sini
// kita cuma hantar yg dah tiba masa, dgn cap per-tik + jeda kecil sesama hantar.
// Gagal → retry dgn backoff sampai MAX_ATTEMPTS.
//
// PENTING: cron-job.org timeout ~30s setiap panggilan. Batch mesti siap bawah itu:
//   12 × (0.5s jeda + ~1.5s hantar) ≈ 20s. Baki pending diambil tik seterusnya.

const PER_TICK = 12            // had mesej satu tik — kekal bawah timeout 30s cron-job.org
const MAX_ATTEMPTS = 3
const INTER_SEND_MS = 500      // jeda antara hantar (elak cap masa serupa)
const BACKOFF_MIN = 10         // minit × attempts sebelum cuba semula

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const maxDuration = 50  // headroom server-side walau cron-job.org putus di 30s (idempotent)

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: due, error } = await admin
    .from('wa_outbox')
    .select('*')   // termasuk blast_id/recipient_id/send_session_id (migration 164) — kempen Blaster gateway
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(PER_TICK)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due?.length) { await stampHeartbeat(admin, 'wa-outbox-drain'); return NextResponse.json({ sent: 0, failed: 0, due: 0 }) }

  let sent = 0
  let failed = 0
  const started = Date.now()
  const BUDGET_MS = 40_000   // gateway hantar 4–9s semesej — berhenti awal, baki diambil tik seterusnya
  const touchedBlasts = new Set<string>()

  type Row = { id: string; phone: string; message: string; attempts: number; blast_id?: string | null; recipient_id?: string | null; send_session_id?: string | null }
  for (let i = 0; i < due.length; i++) {
    const row = due[i] as Row
    if (i > 0) await sleep(INTER_SEND_MS)
    if (Date.now() - started > BUDGET_MS) break

    // Kempen Blaster gateway: HANTAR melalui session yang ditetapkan (bukan putaran); selain itu laluan lama.
    const gw = row.send_session_id ? await gatewaySendText(row.send_session_id, row.phone, row.message) : null
    const res = gw
      ? { success: gw.ok, session_id: row.send_session_id, message_id: gw.id ?? null, error: gw.error, code: gw.code }
      : await sendWhatsApp(row.phone, row.message).catch((e: unknown) => ({ success: false, error: String(e) }) as const)
    const ok = (res as { success?: boolean }).success === true
    const attempts = row.attempts + 1
    if (row.blast_id) touchedBlasts.add(row.blast_id)

    if (ok) {
      const msgId = (res as { message_id?: string | null }).message_id ?? (res as { murpati?: { message_id?: string } }).murpati?.message_id ?? null
      await admin
        .from('wa_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          session_id: (res as { session_id?: string }).session_id ?? null,
          attempts,
        })
        .eq('id', row.id)
      if (row.recipient_id) await admin.from('crm_blast_recipients').update({ status: 'sent', wa_message_id: msgId, sent_at: new Date().toISOString(), error: null }).eq('id', row.recipient_id)
      sent++
    } else {
      const errText = JSON.stringify((res as { error?: unknown }).error ?? res).slice(0, 500)
      const action = gw ? gatewayFailureAction((res as { code?: string }).code) : 'retry'
      if (action === 'window') {
        // Had harian / luar tetingkap: tunggu 09:00 seterusnya — bukan kegagalan, attempts tidak ditambah
        const code = (res as { code?: string }).code
        await admin.from('wa_outbox').update({ scheduled_at: new Date(nextWindowStart(Date.now(), code === 'daily_cap')).toISOString(), last_error: errText }).eq('id', row.id)
        continue
      }
      if (action === 'busy') {
        await admin.from('wa_outbox').update({ scheduled_at: new Date(Date.now() + 2 * 60_000).toISOString(), last_error: errText }).eq('id', row.id)
        continue
      }
      const giveUp = action === 'final' || attempts >= MAX_ATTEMPTS
      const update: Record<string, unknown> = {
        status: giveUp ? 'failed' : 'pending',
        attempts,
        last_error: errText,
      }
      // Backoff: lengahkan cubaan seterusnya (skipped tiada-kredensi pun masuk sini)
      if (!giveUp) update.scheduled_at = new Date(Date.now() + attempts * BACKOFF_MIN * 60_000).toISOString()
      await admin.from('wa_outbox').update(update).eq('id', row.id)
      if (giveUp && row.recipient_id) await admin.from('crm_blast_recipients').update({ status: 'failed', error: errText.slice(0, 200), failed_at: new Date().toISOString() }).eq('id', row.recipient_id)
      failed++
    }
  }
  // Tutup kempen gateway yang semua penerimanya selesai
  for (const b of touchedBlasts) await finalizeGatewayBlast(admin, b).catch(() => {})

  console.log(`[wa-outbox-drain] sent ${sent}, failed ${failed}, due ${due.length}`)
  await stampHeartbeat(admin, 'wa-outbox-drain')
  return NextResponse.json({ sent, failed, due: due.length })
}
