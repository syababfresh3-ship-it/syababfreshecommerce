import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeNpmAudit, auditKey } from '@/lib/security-digest'

// POST /api/security/report — pelapor (GitHub Actions storefront, cron VPS gateway) hantar hasil `npm audit --json`.
// Auth: Authorization: Bearer <CRON_SECRET>. Body: { source: 'storefront'|'gateway', audit: <npm audit json>, node?, ref? }
// Disimpan di app_settings `security_audit:<source>`; dibaca oleh cron /api/cron/security-digest & dashboard.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { source?: string; audit?: unknown; node?: string; ref?: string } | null
  const source = String(body?.source ?? '').trim().toLowerCase()
  if (!/^[a-z0-9_-]{2,30}$/.test(source)) return NextResponse.json({ ok: false, error: 'source tidak sah' }, { status: 400 })
  if (!body?.audit || typeof body.audit !== 'object') return NextResponse.json({ ok: false, error: 'audit (JSON npm audit) diperlukan' }, { status: 400 })
  const report = normalizeNpmAudit(source, body.audit, { node: body.node ?? null, ref: body.ref ?? null })
  const admin = createAdminClient()
  const { error } = await admin.from('app_settings').upsert({ key: auditKey(source), value: JSON.stringify(report), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, counts: report.counts, items: report.items.length })
}
