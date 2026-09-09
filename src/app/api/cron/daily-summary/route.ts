export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { createAdminClient } from '@/lib/supabase/admin'
import { stampHeartbeat, stampHeartbeatError } from '@/lib/cron-heartbeat'
import { buildDailySummary, formatSummaryText, sendDailySummary, isValidYmd } from '@/lib/daily-summary'

// Ringkasan harian untuk admin — jualan semalam (waktu KL), COD tertunggak,
// pending, stok rendah, batch luput, refund, cron senyap, ralat storefront.
// Dihantar ke WA admin (ADMIN_WHATSAPP) + push admin + email (ADMIN_EMAIL,
// pilihan). Dijadual cron-job.org 08:30 harian (lihat docs/cron-inventory.md).
// Dilindungi CRON_SECRET (Bearer).
//
// Query:
//   ?dry=1            bina laporan TANPA hantar & TANPA stamp heartbeat (uji)
//   ?date=YYYY-MM-DD  laporan untuk hari KL tertentu (default: semalam)

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const dry = url.searchParams.get('dry') === '1'
  const dateParam = url.searchParams.get('date')

  const admin = createAdminClient()
  try {
    const report = await buildDailySummary(admin, { date: isValidYmd(dateParam) ? dateParam : undefined })
    const delivery = dry ? null : await sendDailySummary(report)

    if (!dry) await stampHeartbeat(admin, 'daily-summary')
    console.log(`[daily-summary] ${report.date} hasil ${report.revenue} / ${report.paidOrders} order` +
      (dry ? ' (dry)' : ` — wa ${delivery?.whatsapp} push ${delivery?.push} email ${delivery?.email}`))

    return Response.json({ ok: true, dry, delivery, text: formatSummaryText(report), report })
  } catch (err) {
    console.error('[daily-summary] gagal:', err)
    if (!dry) await stampHeartbeatError(admin, 'daily-summary', err)
    return Response.json({ ok: false, error: String((err as Error)?.message ?? err) }, { status: 500 })
  }
}
