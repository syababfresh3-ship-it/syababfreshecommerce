export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { createAdminClient } from '@/lib/supabase/admin'
import { getAppSettings } from '@/lib/app-settings'
import { sendWhatsApp } from '@/lib/murpati'
import { stampHeartbeat, stampHeartbeatError } from '@/lib/cron-heartbeat'
import { setAgentStatus } from '@/lib/office'

// Kredit komisen affiliate yang cukup tempoh tahan (migration 165).
//
// Aliran: order delivered+dibayar → affiliate_schedule_credit set credit_after =
// now + affiliate_hold_days (lalai 7) → cron ini (setiap jam, vercel.json) panggil
// RPC affiliate_credit_due: SATU transaksi semak semula order masih delivered & tak
// refund + affiliate masih aktif → status 'credited' + baki naik; yang gagal → 'reversed'.
// RPC juga sapu pending yang ordernya dibatalkan melalui laluan lain.
//
// Notifikasi WhatsApp kepada affiliate (jumlah dikreditkan + baki) hanya bila
// app_settings.affiliate_notify_wa = 'on' (lalai off — dasar WA: hantar minimum).
// Dilindungi CRON_SECRET (Bearer). Idempotent — selamat dipanggil berulang.

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const admin = createAdminClient()
  await setAgentStatus(admin, { agent: 'nurul', state: 'working', task: 'Kredit komisen affiliate yang cukup tempoh tahan' })
  try {
    const { data, error } = await admin.rpc('affiliate_credit_due', { p_limit: 300 })
    if (error) throw error
    const rows = (data ?? []) as { affiliate_id: string; total: number | string; n: number }[]
    const total = rows.reduce((s, r) => s + Number(r.total || 0), 0)

    const settings = await getAppSettings()
    let notified = 0
    if (settings['affiliate_notify_wa'] === 'on' && rows.length > 0) {
      const ids = rows.map(r => r.affiliate_id)
      const { data: profs } = await admin.from('profiles').select('id, full_name, phone, affiliate_balance').in('id', ids)
      const byId = new Map((profs ?? []).map(p => [p.id as string, p]))
      const url = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'}/affiliate`
      for (const r of rows) {
        const p = byId.get(r.affiliate_id)
        if (!p?.phone) continue
        const msg = [
          `Komisen affiliate dikreditkan: RM${Number(r.total).toFixed(2)} (${r.n} baris pesanan).`,
          `Baki boleh dikeluarkan: RM${Number(p.affiliate_balance ?? 0).toFixed(2)}.`,
          `Pantau di ${url}`,
        ].join('\n')
        const ok = await sendWhatsApp(p.phone, msg).then(() => true).catch(() => false)
        if (ok) notified++
      }
    }

    await stampHeartbeat(admin, 'affiliate-credit')
    await setAgentStatus(admin, { agent: 'nurul', state: 'idle', task: 'Siap: kredit komisen affiliate' })
    return Response.json({ ok: true, affiliates: rows.length, total: Math.round(total * 100) / 100, notified })
  } catch (err) {
    await stampHeartbeatError(admin, 'affiliate-credit', err).catch(() => {})
    await setAgentStatus(admin, { agent: 'nurul', state: 'idle', task: 'Gagal: kredit komisen affiliate' })
    const msg = (err as Error)?.message ?? String(err)
    return Response.json({ ok: false, error: msg }, { status: 500 })
  }
}
