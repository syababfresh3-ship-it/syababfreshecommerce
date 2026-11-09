import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { OUTLET_MISSING } from '@/lib/pos/outlets'
import { klDateStr } from '@/lib/pos/dates'

// Outlet POS (migration 157). GET → { outlets:[{..., stats}], migrationOk } · POST { code, name, type, location, starts_on, ends_on }
// · PATCH { id, name?, location?, type?, is_active?, starts_on?, ends_on? }
export const dynamic = 'force-dynamic'
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sb = supabase!
  const outlets = await sb.from('pos_outlets').select('*').order('type').order('code')
  if (outlets.error) return NextResponse.json({ error: OUTLET_MISSING.has(outlets.error.code ?? '') ? 'Migration 157 (outlets) has not been run' : outlets.error.message, outlets: [], migrationOk: false }, { status: OUTLET_MISSING.has(outlets.error.code ?? '') ? 503 : 500 })
  const today = klDateStr(new Date())
  const from = new Date(`${today}T00:00:00+08:00`).toISOString(), to = new Date(`${today}T23:59:59.999+08:00`).toISOString()
  const [pending, stock, sales] = await Promise.all([
    sb.from('pos_transfers').select('to_outlet_id').eq('status', 'issued'),
    sb.from('pos_outlet_stock').select('outlet_id, qty'),
    sb.from('pos_sales').select('outlet_id, total, status').gte('sold_at', from).lte('sold_at', to),
  ])
  const agg = new Map<string, { pending: number; stockLines: number; sales: number; revenue: number }>()
  const g = (id: string) => { if (!agg.has(id)) agg.set(id, { pending: 0, stockLines: 0, sales: 0, revenue: 0 }); return agg.get(id)! }
  for (const r of (pending.data ?? []) as { to_outlet_id: string }[]) g(r.to_outlet_id).pending++
  for (const r of (stock.data ?? []) as { outlet_id: string; qty: number | string }[]) if (Number(r.qty) > 0) g(r.outlet_id).stockLines++
  for (const r of (sales.data ?? []) as { outlet_id: string | null; total: number | string; status: string }[]) if (r.outlet_id && r.status === 'paid') { const a = g(r.outlet_id); a.sales++; a.revenue += Number(r.total) }
  // HQ dahulu, kemudian outlet aktif, kemudian tidak aktif; dalam kumpulan ikut kod
  const rank = (o: { type: string; is_active: boolean }) => (o.type === 'hq' ? 0 : o.is_active ? 1 : 2)
  const sorted = ((outlets.data ?? []) as { id: string; code: string; type: string; is_active: boolean }[]).slice().sort((a, b) => rank(a) - rank(b) || a.code.localeCompare(b.code))
  return NextResponse.json({ outlets: sorted.map(o => ({ ...o, stats: agg.get(o.id) ?? { pending: 0, stockLines: 0, sales: 0, revenue: 0 } })), migrationOk: true, today })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const code = str(b.code, 12).toUpperCase(), name = str(b.name, 80)
  if (!/^[A-Z0-9-]{1,12}$/.test(code) || !name) return NextResponse.json({ error: 'Code (A–Z/0–9) and name are required' }, { status: 400 })
  const type = b.type === 'store' ? 'store' : b.type === 'hq' ? 'hq' : 'bazaar'
  const { data, error } = await supabase!.from('pos_outlets').insert({ code, name, type, location: str(b.location, 120) || null, starts_on: date(b.starts_on), ends_on: date(b.ends_on) }).select('*').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Outlet code already exists' : OUTLET_MISSING.has(error.code ?? '') ? 'Migration 157 (outlets) has not been run' : error.message }, { status: OUTLET_MISSING.has(error.code ?? '') ? 503 : 400 })
  return NextResponse.json({ outlet: { ...data, stats: { pending: 0, stockLines: 0, sales: 0, revenue: 0 } } })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (typeof b.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if ('name' in b) { const name = str(b.name, 80); if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 }); patch.name = name }
  if ('location' in b) patch.location = str(b.location, 120) || null
  if ('type' in b && ['hq', 'bazaar', 'store'].includes(b.type)) patch.type = b.type
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active
  if ('starts_on' in b) patch.starts_on = date(b.starts_on)
  if ('ends_on' in b) patch.ends_on = date(b.ends_on)
  const { data, error } = await supabase!.from('pos_outlets').update(patch).eq('id', b.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ outlet: data })
}
