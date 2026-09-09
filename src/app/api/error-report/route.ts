export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// Terima laporan ralat dari error boundary (client) → error_reports (124).
// FAIL-SOFT: dipanggil ketika page dah rosak — TAK PERNAH throw / 5xx ke client.
// Tanpa auth (pelawat awam) → rate limit 10/IP/10min + semua medan dipotong.
// Jadual mungkin belum wujud (migration belum jalan) → log & pulang ok.

const MAX = { digest: 64, message: 500, path: 300, userAgent: 300 } as const

function clip(v: unknown, n: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, n) : null
}

const OK = () => NextResponse.json({ ok: true })

export async function POST(req: Request) {
  try {
    const ip = clientIp(req)
    if (!rateLimit('err:' + ip, 10, 10 * 60_000)) {
      return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return OK()
    }
    if (!body || typeof body !== 'object') return OK()

    const row = {
      digest: clip(body.digest, MAX.digest),
      message: clip(body.message, MAX.message),
      path: clip(body.pathname ?? body.path, MAX.path),
      user_agent: clip(body.userAgent, MAX.userAgent) ?? clip(req.headers.get('user-agent'), MAX.userAgent),
      ip_hash: ip && ip !== 'unknown'
        ? createHash('sha256').update(ip + (process.env.CRON_SECRET ?? '')).digest('hex').slice(0, 16)
        : null,
    }
    if (!row.message && !row.digest) return OK()

    const { error } = await createAdminClient().from('error_reports').insert(row)
    if (error) console.warn('[error-report] insert gagal (jadual belum ada?):', error.message)
    return OK()
  } catch (err) {
    console.warn('[error-report] gagal senyap:', err)
    return OK()
  }
}
