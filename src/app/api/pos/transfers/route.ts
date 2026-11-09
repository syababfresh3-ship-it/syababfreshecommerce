import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { loadOutletOfRegister } from '@/lib/pos/outlets'

// DO untuk outlet register ini (peranti): ?register=<id> → { outlet, pending:[issued], recent:[confirmed 7 hari] }.
// Toleran bila 157 belum run → outlet null, senarai kosong.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const sb = auth.supabase!
  const register = new URL(request.url).searchParams.get('register')
  const outlet = await loadOutletOfRegister(sb, register)
  if (!outlet) return NextResponse.json({ outlet: null, pending: [], recent: [] })
  const since = new Date(Date.now() - 7 * 86400_000).toISOString()
  const sel = '*, from_outlet:pos_outlets!from_outlet_id(id, code, name, type), to_outlet:pos_outlets!to_outlet_id(id, code, name, type), confirmed_cashier:pos_cashiers!confirmed_cashier_id(name), pos_transfer_items(*)'
  const [pending, recent] = await Promise.all([
    sb.from('pos_transfers').select(sel).eq('to_outlet_id', outlet.id).eq('status', 'issued').order('issued_at', { ascending: true }),
    sb.from('pos_transfers').select(sel).eq('to_outlet_id', outlet.id).eq('status', 'confirmed').gte('confirmed_at', since).order('confirmed_at', { ascending: false }).limit(20),
  ])
  const sortItems = (rows: unknown[]) => (rows as { pos_transfer_items?: { sort: number }[] }[]).map(t => ({ ...t, pos_transfer_items: (t.pos_transfer_items ?? []).slice().sort((a, b) => a.sort - b.sort) }))
  return NextResponse.json({ outlet, pending: sortItems(pending.data ?? []), recent: sortItems(recent.data ?? []) })
}
