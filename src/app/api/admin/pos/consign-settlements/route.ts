import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isValidYmd } from '@/lib/daily-summary'
import { ConsignError, createSettlement, deleteSettlement, isUuid } from '@/lib/pos/consign'

// Penyata penyelesaian konsainan. GET ?consignor=<id> → { settlements } · POST { consignor_id, from, to, note? } → cipta
// PATCH { id, action: 'paid'|'unpaid', pay_ref? } · DELETE ?id= (hanya belum dibayar; baris dilepaskan semula)
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const consignor = new URL(request.url).searchParams.get('consignor')
  let q = supabase!.from('pos_consign_settlements').select('*, pos_consignors(name)').order('created_at', { ascending: false }).limit(200)
  if (isUuid(consignor)) q = q.eq('consignor_id', consignor)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message, settlements: [] }, { status: 500 })
  return NextResponse.json({ settlements: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, forbidden, user } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (!isUuid(b.consignor_id) || !isValidYmd(b.from) || !isValidYmd(b.to)) return NextResponse.json({ error: 'Supplier and period are required' }, { status: 400 })
  try {
    return NextResponse.json({ settlement: await createSettlement(supabase!, { consignorId: b.consignor_id, from: b.from, to: b.to, note: typeof b.note === 'string' ? b.note : null, userId: user?.id ?? null }) })
  } catch (e) {
    if (e instanceof ConsignError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (!isUuid(b.id) || (b.action !== 'paid' && b.action !== 'unpaid')) return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
  const patch = b.action === 'paid'
    ? { status: 'paid', paid_at: new Date().toISOString(), pay_ref: typeof b.pay_ref === 'string' ? b.pay_ref.trim().slice(0, 80) || null : null }
    : { status: 'unpaid', paid_at: null, pay_ref: null }
  const { data, error } = await supabase!.from('pos_consign_settlements').update(patch).eq('id', b.id).select('*, pos_consignors(name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ settlement: data })
}

export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const id = new URL(request.url).searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  try { await deleteSettlement(supabase!, id); return NextResponse.json({ ok: true }) }
  catch (e) {
    if (e instanceof ConsignError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
