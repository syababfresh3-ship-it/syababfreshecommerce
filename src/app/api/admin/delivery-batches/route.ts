import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// GET /api/admin/delivery-batches?date=2026-04-27
export async function GET(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const { data: batches, error } = await supabase!
    .from('delivery_batches')
    .select('*, delivery_batch_orders(order_id, stop_sequence)')
    .eq('batch_date', date)
    .order('zone_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ batches })
}

// POST /api/admin/delivery-batches — save entire batch for a date
// Body: { date, cutoff_time, groups: [{ zone_id, zone_name, status, order_ids }] }
export async function POST(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await req.json()
  const { date, cutoff_time, groups } = body as {
    date: string
    cutoff_time: string
    groups: { zone_id: string; zone_name: string; status: string; order_ids: string[] }[]
  }

  if (!date || !groups?.length) {
    return NextResponse.json({ error: 'date dan groups diperlukan' }, { status: 400 })
  }

  // Delete existing batches for this date (full replace)
  await supabase!.from('delivery_batches').delete().eq('batch_date', date)

  // Insert new batches
  const batchRows = groups
    .filter((g) => g.order_ids.length > 0)
    .map((g, idx) => ({
      batch_code: `${date.replace(/-/g, '')}-${g.zone_id.toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
      batch_date: date,
      cutoff_time: cutoff_time ?? '15:00',
      zone_id: g.zone_id,
      zone_name: g.zone_name,
      status: g.status ?? 'draft',
      stop_count: g.order_ids.length,
    }))

  const { data: inserted, error: batchErr } = await supabase!
    .from('delivery_batches')
    .insert(batchRows)
    .select('id, zone_id')

  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 })

  // Insert batch–order links
  const batchMap = new Map((inserted ?? []).map((b: any) => [b.zone_id, b.id]))
  const orderRows: { batch_id: string; order_id: string; stop_sequence: number }[] = []

  for (const g of groups.filter((g) => g.order_ids.length > 0)) {
    const batchId = batchMap.get(g.zone_id)
    if (!batchId) continue
    g.order_ids.forEach((oid, seq) => {
      orderRows.push({ batch_id: batchId, order_id: oid, stop_sequence: seq + 1 })
    })
  }

  if (orderRows.length > 0) {
    const { error: ordersErr } = await supabase!.from('delivery_batch_orders').insert(orderRows)
    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, batches: inserted?.length ?? 0 })
}
