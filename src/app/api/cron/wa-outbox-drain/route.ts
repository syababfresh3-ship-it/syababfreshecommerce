import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'

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
    .select('id, phone, message, attempts')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(PER_TICK)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due?.length) return NextResponse.json({ sent: 0, failed: 0, due: 0 })

  let sent = 0
  let failed = 0

  for (let i = 0; i < due.length; i++) {
    const row = due[i]
    if (i > 0) await sleep(INTER_SEND_MS)

    const res = await sendWhatsApp(row.phone, row.message).catch(
      (e: unknown) => ({ success: false, error: String(e) }) as const,
    )
    const ok = (res as { success?: boolean }).success === true
    const attempts = row.attempts + 1

    if (ok) {
      await admin
        .from('wa_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          session_id: (res as { session_id?: string }).session_id ?? null,
          attempts,
        })
        .eq('id', row.id)
      sent++
    } else {
      const giveUp = attempts >= MAX_ATTEMPTS
      const update: Record<string, unknown> = {
        status: giveUp ? 'failed' : 'pending',
        attempts,
        last_error: JSON.stringify((res as { error?: unknown }).error ?? res).slice(0, 500),
      }
      // Backoff: lengahkan cubaan seterusnya (skipped tiada-kredensi pun masuk sini)
      if (!giveUp) update.scheduled_at = new Date(Date.now() + attempts * BACKOFF_MIN * 60_000).toISOString()
      await admin.from('wa_outbox').update(update).eq('id', row.id)
      failed++
    }
  }

  console.log(`[wa-outbox-drain] sent ${sent}, failed ${failed}, due ${due.length}`)
  return NextResponse.json({ sent, failed, due: due.length })
}
