import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Stamp orders as exported-for-shipping so the exports list can hide them and
// staff don't ship the same order twice. IDs are UUIDs unique across both tables.
// Returns `already` = orders that were ALREADY exported before this call, so the
// UI can warn a second staff who re-exported the same orders from a stale page.
export async function POST(req: NextRequest) {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No order ids' }, { status: 400 })
  }

  // Snapshot current state first — anything already stamped was exported by an
  // earlier run (possibly another staff).
  const [ordRows, lpRows] = await Promise.all([
    supabase.from('orders').select('order_number, exported_at').in('id', ids),
    supabase.from('lp_guest_orders').select('order_number, exported_at').in('id', ids),
  ])
  const already = [...(ordRows.data ?? []), ...(lpRows.data ?? [])]
    .filter((r) => r.exported_at)
    .map((r) => ({ order_number: r.order_number as string, exported_at: r.exported_at as string }))

  // Stamp only the not-yet-exported rows so the original export time is preserved.
  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('orders').update({ exported_at: now }).in('id', ids).is('exported_at', null),
    supabase.from('lp_guest_orders').update({ exported_at: now }).in('id', ids).is('exported_at', null),
  ])

  return NextResponse.json({ ok: true, marked: ids.length - already.length, already })
}
