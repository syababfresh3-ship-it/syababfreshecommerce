import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { OUTLET_MISSING, TransferError, issueTransfer, loadTransfer, normalizeTransferItem } from '@/lib/pos/outlets'

// Pindahan (DO). GET ?status=&outlet=&limit= → { transfers } · POST { kind?, from_outlet_id, to_outlet_id, note?, items:[...], issue?: boolean }
// kind auto: dari HQ → 'out'; ke HQ → 'return'. issue:true = terus keluarkan (nombor DO + stok bergerak).
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i
const TRANSFER_SELECT = '*, from_outlet:pos_outlets!from_outlet_id(id, code, name, type), to_outlet:pos_outlets!to_outlet_id(id, code, name, type), confirmed_cashier:pos_cashiers!confirmed_cashier_id(name), pos_transfer_items(*)'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sp = new URL(request.url).searchParams
  let q = supabase!.from('pos_transfers').select(TRANSFER_SELECT).order('created_at', { ascending: false }).limit(Math.min(300, Math.max(1, Number(sp.get('limit')) || 100)))
  const status = sp.get('status'); if (status && ['draft', 'issued', 'confirmed', 'cancelled'].includes(status)) q = q.eq('status', status)
  const outlet = sp.get('outlet'); if (outlet && UUID.test(outlet)) q = q.or(`from_outlet_id.eq.${outlet},to_outlet_id.eq.${outlet}`)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: OUTLET_MISSING.has(error.code ?? '') ? 'Migration 157 (outlets) has not been run' : error.message, transfers: [] }, { status: OUTLET_MISSING.has(error.code ?? '') ? 503 : 500 })
  return NextResponse.json({ transfers: (data ?? []).map((t: { pos_transfer_items?: { sort: number }[] }) => ({ ...t, pos_transfer_items: (t.pos_transfer_items ?? []).slice().sort((a, b) => a.sort - b.sort) })) })
}

export async function POST(request: Request) {
  const { supabase, forbidden, user } = await requireAdmin()
  if (forbidden) return forbidden
  const sb = supabase!
  const b = await request.json().catch(() => ({}))
  const from = typeof b.from_outlet_id === 'string' && UUID.test(b.from_outlet_id) ? b.from_outlet_id : ''
  const to = typeof b.to_outlet_id === 'string' && UUID.test(b.to_outlet_id) ? b.to_outlet_id : ''
  if (!from || !to) return NextResponse.json({ error: 'From and To outlets are required' }, { status: 400 })
  if (from === to) return NextResponse.json({ error: 'From and To must be different outlets' }, { status: 400 })
  const rawItems = Array.isArray(b.items) ? b.items : []
  if (rawItems.length === 0) return NextResponse.json({ error: 'Add at least one line' }, { status: 400 })
  const items = []
  for (let i = 0; i < rawItems.length; i++) { const r = normalizeTransferItem(rawItems[i], i); if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 }); items.push(r.item) }
  const { data: outlets } = await sb.from('pos_outlets').select('id, type').in('id', [from, to])
  const typeOf = new Map(((outlets ?? []) as { id: string; type: string }[]).map(o => [o.id, o.type]))
  if (typeOf.size < 2) return NextResponse.json({ error: 'Outlet not found' }, { status: 404 })
  const kind = typeOf.get(to) === 'hq' ? 'return' : 'out'
  const { data: t, error } = await sb.from('pos_transfers').insert({ kind, from_outlet_id: from, to_outlet_id: to, note: typeof b.note === 'string' ? b.note.trim().slice(0, 500) || null : null, created_by: user?.id ?? null }).select('id').single()
  if (error) return NextResponse.json({ error: OUTLET_MISSING.has(error.code ?? '') ? 'Migration 157 (outlets) has not been run' : error.message }, { status: OUTLET_MISSING.has(error.code ?? '') ? 503 : 400 })
  const { error: iErr } = await sb.from('pos_transfer_items').insert(items.map(it => ({ ...it, transfer_id: t.id })))
  if (iErr) { await sb.from('pos_transfers').delete().eq('id', t.id); return NextResponse.json({ error: iErr.message }, { status: 400 }) }
  try {
    const transfer = b.issue === true ? await issueTransfer(sb, t.id, { userId: user?.id ?? null }) : await loadTransfer(sb, t.id)
    return NextResponse.json({ transfer })
  } catch (e) {
    if (e instanceof TransferError) return NextResponse.json({ error: e.message, transfer: await loadTransfer(sb, t.id) }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
