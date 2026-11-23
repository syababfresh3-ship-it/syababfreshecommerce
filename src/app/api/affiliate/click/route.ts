import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitDb } from '@/lib/rate-limit-db'
import { safeClientIp } from '@/lib/order-guard'
import { normalizeAffCode } from '@/lib/affiliate-attribution'

// POST /api/affiliate/click — rekod klik pautan affiliate (?aff=KOD) di pelayan.
// Pulangkan { id } yang klien simpan & hantar bersama order → pelayan sahkan tetingkap
// 30 hari ikut masa klik DI SINI (bukan localStorage). Juga asas kiraan klik & kadar
// tukaran di dashboard affiliate. Best-effort: ralat → { ok:false } senyap, tak sekat page.
// Migration 165.

const SCOPE_RE = /^(\*|lp:[a-z0-9-]{1,100}|[a-z0-9-]{1,100})$/

export async function POST(request: Request) {
  const ip = safeClientIp(request)
  if (!(await rateLimitDb('affc:' + (ip ?? 'unknown'), 30, 60_000)))
    return NextResponse.json({ ok: false }, { status: 429 })

  const body = await request.json().catch(() => ({}))
  const code = normalizeAffCode(body?.code)
  if (!code) return NextResponse.json({ ok: false, error: 'Kod tidak sah' }, { status: 400 })
  const scope: string = typeof body?.scope === 'string' && SCOPE_RE.test(body.scope) ? body.scope : '*'
  const path: string | null = typeof body?.path === 'string' ? body.path.slice(0, 200) : null

  const sb = createAdminClient()
  const { data: aff } = await sb
    .from('profiles')
    .select('id')
    .eq('referral_code', code)
    .eq('is_affiliate', true)
    .maybeSingle()
  if (!aff) return NextResponse.json({ ok: false, error: 'Kod tidak aktif' }, { status: 404 })

  let product_id: string | null = null
  let lp_slug: string | null = null
  if (scope.startsWith('lp:')) {
    lp_slug = scope.slice(3)
  } else if (scope !== '*') {
    const { data: p } = await sb.from('products').select('id').eq('slug', scope).maybeSingle()
    product_id = p?.id ?? null
  }

  // Hash IP (bukan IP mentah) — cukup untuk nyahgandakan refresh, tak simpan data peribadi.
  const ip_hash = ip
    ? createHash('sha256').update(`${ip}|${process.env.CRON_SECRET ?? 'sf-aff'}`).digest('hex').slice(0, 32)
    : null

  if (ip_hash) {
    const since = new Date(Date.now() - 10 * 60_000).toISOString()
    const { data: dup } = await sb
      .from('affiliate_clicks')
      .select('id')
      .eq('affiliate_id', aff.id)
      .eq('ip_hash', ip_hash)
      .eq('scope', scope)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (dup?.id) return NextResponse.json({ ok: true, id: dup.id, dedupe: true })
  }

  const user_agent = (request.headers.get('user-agent') ?? '').slice(0, 200) || null
  const { data: row, error } = await sb
    .from('affiliate_clicks')
    .insert({ affiliate_id: aff.id, code, scope, path, product_id, lp_slug, ip_hash, user_agent })
    .select('id')
    .single()
  if (error || !row) return NextResponse.json({ ok: false }, { status: 200 })
  return NextResponse.json({ ok: true, id: row.id })
}
