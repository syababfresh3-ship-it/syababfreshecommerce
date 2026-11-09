import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { buildPosDayReport } from '@/lib/pos/reports'
import { klDateStr, isValidYmd } from '@/lib/daily-summary'

// Laporan X (hari ini) — ?date=YYYY-MM-DD&register=<id>
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const sp = new URL(request.url).searchParams
  const date = isValidYmd(sp.get('date')) ? sp.get('date')! : klDateStr(new Date())
  try {
    const report = await buildPosDayReport(auth.supabase!, date, sp.get('register'))
    if (!report) return NextResponse.json({ error: 'Migration 155 (POS) has not been run' }, { status: 503 })
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
