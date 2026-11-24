export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stampHeartbeat, stampHeartbeatError } from '@/lib/cron-heartbeat'
import { sendAdminEmail } from '@/lib/zeptomail'
import { sendAdminPush } from '@/lib/push'
import { setAgentStatus } from '@/lib/office'
import { fetchRelevantCves, AUDIT_SOURCES, auditKey, type AuditReport } from '@/lib/security-digest'

// Ringkasan keselamatan mingguan (Vercel cron, Isnin 00:10 UTC = 08:10 MYT): CVE Cloudflare Radar yang
// padan stack kita (CVSS ≥ 7) + laporan npm audit storefront & gateway (dari /api/security/report).
// Saluran: emel admin + push admin (sama seperti amaran gateway). Tiada data pelanggan.
const JOB = 'security-digest'
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const kl = (d: Date | string) => new Date(d).toLocaleString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return new Response('Unauthorized', { status: 401 })
  const admin = createAdminClient()
  await admin.from('cron_heartbeats').upsert({ job: JOB, expected_minutes: 10080 }, { onConflict: 'job', ignoreDuplicates: true })
  await setAgentStatus(admin, { agent: 'nurul', state: 'working', task: 'Weekly security digest: CVE feed + npm audit' })
  try {
    const [cves, { data: auditRows }] = await Promise.all([
      fetchRelevantCves(7),
      admin.from('app_settings').select('key, value, updated_at').in('key', AUDIT_SOURCES.map(auditKey)),
    ])
    const audits: AuditReport[] = []
    for (const r of (auditRows ?? []) as { key: string; value: string }[]) { try { audits.push(JSON.parse(r.value) as AuditReport) } catch { /* abaikan */ } }
    const missing = AUDIT_SOURCES.filter(s => !audits.some(a => a.source === s))
    const staleAudits = audits.filter(a => Date.now() - new Date(a.at).getTime() > 10 * 86_400_000).map(a => a.source)
    const critHigh = audits.reduce((n, a) => n + a.counts.critical + a.counts.high, 0)
    const urgent = cves.relevant.length > 0 || critHigh > 0 || missing.length > 0 || staleAudits.length > 0

    const rows: string[] = []
    rows.push(`<p><b>Ringkasan keselamatan mingguan</b> · ${kl(new Date())}</p>`)
    rows.push(`<p><b>CVE Cloudflare Radar</b> (${cves.ok ? `${cves.total} terbaru disemak` : `gagal dibaca: ${esc(cves.error ?? '')}`}) — padan stack kita, CVSS ≥ 7: <b>${cves.relevant.length}</b></p>`)
    if (cves.relevant.length) rows.push('<ul>' + cves.relevant.slice(0, 15).map(c => `<li><a href="${esc(c.link)}">${esc(c.id)}</a> ${c.cvss != null ? `CVSS ${c.cvss}` : ''} — ${esc(c.title)} <span style="color:#6b7280">(${esc(c.hits.join(', '))})</span></li>`).join('') + '</ul>')
    rows.push('<p><b>npm audit</b> (kebergantungan produksi)</p>')
    for (const a of audits) {
      rows.push(`<p><b>${esc(a.source)}</b> · ${kl(a.at)}${a.ref ? ` · ${esc(a.ref)}` : ''} — critical ${a.counts.critical}, high ${a.counts.high}, moderate ${a.counts.moderate}, low ${a.counts.low}</p>`)
      if (a.items.length) rows.push('<ul>' + a.items.slice(0, 12).map(i => `<li><b>${esc(i.name)}</b> (${esc(i.severity)}) ${esc(i.title)}${i.fixAvailable ? ` — pembetulan: ${i.fixAvailable === 'major' ? 'perlu naik taraf major' : 'tersedia'}` : ''}${i.url ? ` <a href="${esc(i.url)}">advisori</a>` : ''}</li>`).join('') + '</ul>')
    }
    if (missing.length) rows.push(`<p style="color:#b45309">Tiada laporan audit untuk: ${esc(missing.join(', '))} (pelapor belum dipasang).</p>`)
    if (staleAudits.length) rows.push(`<p style="color:#b45309">Laporan audit lapuk (&gt;10 hari): ${esc(staleAudits.join(', '))}.</p>`)
    rows.push('<p style="color:#6b7280;font-size:12px">Patch OS VPS: unattended-upgrades (origin noble-security) setiap hari; reboot manual bila /var/run/reboot-required wujud. Sumber: radar.cloudflare.com/zero-wire/cves, npm audit.</p>')

    const subject = `Keselamatan mingguan: ${cves.relevant.length} CVE relevan · ${critHigh} critical/high npm${urgent ? '' : ' · tiada isu'}`
    await Promise.allSettled([
      sendAdminEmail({ subject, html: rows.join('') }),
      urgent ? sendAdminPush({ title: 'Ringkasan keselamatan mingguan', body: `${cves.relevant.length} CVE relevan, ${critHigh} critical/high dalam npm audit`, url: '/admin/pejabat', tag: 'security-digest' }) : Promise.resolve(),
    ])
    await stampHeartbeat(admin, JOB)
    await setAgentStatus(admin, { agent: 'nurul', state: 'idle', task: `Done: security digest (${cves.relevant.length} CVE, ${critHigh} npm critical/high)` })
    return NextResponse.json({ ok: true, cves: { ok: cves.ok, total: cves.total, relevant: cves.relevant.length, error: cves.error ?? null }, audits: audits.map(a => ({ source: a.source, at: a.at, counts: a.counts })), missing, staleAudits })
  } catch (e) {
    await stampHeartbeatError(admin, JOB, e)
    await setAgentStatus(admin, { agent: 'nurul', state: 'idle', task: 'Failed: security digest' })
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 })
  }
}
