import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isValidYmd } from '@/lib/daily-summary'
import { klDateStr, shiftDateStr } from '@/lib/pos/dates'
import { buildPosRangeReport } from '@/lib/pos/reports'

// Dashboard jualan POS (admin): ?from=YYYY-MM-DD&to=YYYY-MM-DD (lalai 7 hari terakhir, maks 92 hari) &outlet=<id>
// → { report, outlets } — outlets untuk penapis (kosong jika migration 157 belum dijalankan).
export const dynamic = 'force-dynamic'
const MAX_DAYS = 92

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sp = new URL(request.url).searchParams
  const today = klDateStr(new Date())
  const to = isValidYmd(sp.get('to')) ? sp.get('to')! : today
  const from = isValidYmd(sp.get('from')) ? sp.get('from')! : shiftDateStr(to, -6)
  if (from > to) return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 })
  if (shiftDateStr(from, MAX_DAYS - 1) < to) return NextResponse.json({ error: `Choose a range of at most ${MAX_DAYS} days` }, { status: 400 })
  try {
    const [report, outlets] = await Promise.all([
      buildPosRangeReport(supabase!, from, to, { outletId: sp.get('outlet') }),
      supabase!.from('pos_outlets').select('id, code, name, type, is_active').order('code'),
    ])
    if (!report) return NextResponse.json({ error: 'Migration 155 (POS) has not been run' }, { status: 503 })
    return NextResponse.json({ report, outlets: outlets.error ? [] : (outlets.data ?? []) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
