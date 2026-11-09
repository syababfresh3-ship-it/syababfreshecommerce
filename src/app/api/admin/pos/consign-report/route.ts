import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isValidYmd } from '@/lib/daily-summary'
import { ConsignError, buildConsignReport, isUuid, restampUnsettled } from '@/lib/pos/consign'

// Jualan konsainan BELUM diselesaikan: GET ?consignor=<id>&from=&to= → { report } (tanpa itemIds)
// POST { consignor_id, action: 'recalculate' } → kira semula baris belum diselesaikan guna terma semasa.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sp = new URL(request.url).searchParams
  const consignor = sp.get('consignor')
  if (!isUuid(consignor)) return NextResponse.json({ error: 'consignor is required' }, { status: 400 })
  try {
    const { itemIds: _ids, ...report } = await buildConsignReport(supabase!, consignor, { from: isValidYmd(sp.get('from')) ? sp.get('from') : null, to: isValidYmd(sp.get('to')) ? sp.get('to') : null })
    void _ids
    return NextResponse.json({ report })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (!isUuid(b.consignor_id)) return NextResponse.json({ error: 'consignor_id is required' }, { status: 400 })
  if (b.action !== 'recalculate') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  try {
    return NextResponse.json(await restampUnsettled(supabase!, b.consignor_id))
  } catch (e) {
    if (e instanceof ConsignError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
