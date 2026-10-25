export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Pipeline Gift — GET ?scope=active|all|done|lost&q= → deals (+sebut harga, invois Refrens, amaran) + ringkasan.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { listDeals } from '@/lib/gift-deals-server'
import { ACTIVE_STAGES } from '@/lib/gift-deals'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sp = new URL(request.url).searchParams
  try {
    const deals = await listDeals(supabase!, { scope: sp.get('scope') ?? 'active', q: sp.get('q') ?? undefined })
    const byStage = Object.fromEntries(ACTIVE_STAGES.map(s => [s, { count: 0, total: 0 }])) as Record<string, { count: number; total: number }>
    for (const d of deals) if (byStage[d.stage]) { byStage[d.stage].count++; byStage[d.stage].total += d.amount }
    const alerts = deals.reduce((n, d) => n + d.alerts.length, 0)
    return NextResponse.json({ deals, summary: { count: deals.length, total: deals.reduce((s, d) => s + d.amount, 0), alerts, byStage } })
  } catch (e) {
    const msg = (e as Error).message
    return NextResponse.json({ error: /gift_deals/.test(msg) ? `Jadual pipeline belum ada — jalankan migration 147 (${msg})` : msg }, { status: 500 })
  }
}
