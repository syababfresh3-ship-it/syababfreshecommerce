import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { safeClientIp } from '@/lib/order-guard'

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!slug || !/^[a-z0-9-]+$/.test(slug))
    return NextResponse.json({ ok: false }, { status: 400 })

  // Anti-bot: lebih 30/min dari satu IP → skip RPC senyap (analytics je,
  // client fire-and-forget; 429 cuma ajar bot benda tak perlu).
  const ip = safeClientIp(request)
  if (!rateLimit('view:' + (ip ?? 'unknown'), 30, 60_000))
    return NextResponse.json({ ok: true })

  const supabase = createAdminClient()
  await supabase.rpc('increment_lp_view_count', { p_slug: slug })

  return NextResponse.json({ ok: true })
}
