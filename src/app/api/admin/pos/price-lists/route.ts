import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// Senarai harga POS (migration 156). GET → { lists:[{..., item_count, register_codes}], migrationOk }
// POST { name, description? } · PATCH { id, name?, description?, is_active? } · DELETE ?id= (item cascade; register → null)
export const dynamic = 'force-dynamic'
const MISSING = new Set(['42P01', 'PGRST205', '42703'])

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const [lists, items, regs] = await Promise.all([
    supabase!.from('pos_price_lists').select('*').order('created_at'),
    supabase!.from('pos_price_list_items').select('price_list_id'),
    supabase!.from('pos_registers').select('code, price_list_id'),
  ])
  if (lists.error) return NextResponse.json({ error: MISSING.has(lists.error.code ?? '') ? 'Migration 156 (price lists) has not been run' : lists.error.message, lists: [], migrationOk: false }, { status: MISSING.has(lists.error.code ?? '') ? 503 : 500 })
  const count = new Map<string, number>()
  for (const r of (items.data ?? []) as { price_list_id: string }[]) count.set(r.price_list_id, (count.get(r.price_list_id) ?? 0) + 1)
  const codes = new Map<string, string[]>()
  for (const r of (regs.data ?? []) as { code: string; price_list_id: string | null }[]) if (r.price_list_id) codes.set(r.price_list_id, [...(codes.get(r.price_list_id) ?? []), r.code])
  return NextResponse.json({ lists: (lists.data ?? []).map((l: { id: string }) => ({ ...l, item_count: count.get(l.id) ?? 0, register_codes: codes.get(l.id) ?? [] })), migrationOk: true })
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const name = str(b.name, 60)
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const { data, error } = await supabase!.from('pos_price_lists').insert({ name, description: str(b.description, 200) || null }).select('*').single()
  if (error) return NextResponse.json({ error: MISSING.has(error.code ?? '') ? 'Migration 156 (price lists) has not been run' : error.message }, { status: MISSING.has(error.code ?? '') ? 503 : 400 })
  return NextResponse.json({ list: { ...data, item_count: 0, register_codes: [] } })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (typeof b.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('name' in b) { const name = str(b.name, 60); if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 }); patch.name = name }
  if ('description' in b) patch.description = str(b.description, 200) || null
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active
  const { data, error } = await supabase!.from('pos_price_lists').update(patch).eq('id', b.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ list: data })
}

export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const { error } = await supabase!.from('pos_price_lists').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
