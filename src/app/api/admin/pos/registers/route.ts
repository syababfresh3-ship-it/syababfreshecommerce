import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// Register/terminal POS (admin). GET senarai · POST { code, name, location } · PATCH { id, code?, name?, location?, is_active? }
export const dynamic = 'force-dynamic'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data, error } = await supabase!.from('pos_registers').select('*').order('code')
  if (error) return NextResponse.json({ error: error.message, registers: [] }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ registers: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const code = typeof b.code === 'string' ? b.code.trim().toUpperCase().slice(0, 12) : ''
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : ''
  if (!/^[A-Z0-9-]{1,12}$/.test(code) || !name) return NextResponse.json({ error: 'Code (A–Z/0–9) and name are required' }, { status: 400 })
  const { data, error } = await supabase!.from('pos_registers').insert({ code, name, location: typeof b.location === 'string' ? b.location.trim().slice(0, 120) || null : null }).select('*').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Register code already exists' : error.message }, { status: 400 })
  return NextResponse.json({ register: data })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (typeof b.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (typeof b.code === 'string') {
    const code = b.code.trim().toUpperCase().slice(0, 12)
    if (!/^[A-Z0-9-]{1,12}$/.test(code)) return NextResponse.json({ error: 'Code must be A–Z/0–9 (max 12)' }, { status: 400 })
    patch.code = code
  }
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 80)
  if (typeof b.location === 'string') patch.location = b.location.trim().slice(0, 120) || null
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active
  // Outlet (migration 157): uuid atau null
  if ('outlet_id' in b) {
    if (b.outlet_id === null || b.outlet_id === '') patch.outlet_id = null
    else if (typeof b.outlet_id === 'string' && /^[0-9a-f-]{36}$/i.test(b.outlet_id)) patch.outlet_id = b.outlet_id
    else return NextResponse.json({ error: 'outlet_id is invalid' }, { status: 400 })
  }
  // Senarai harga (migration 156): uuid atau null (= harga kedai)
  if ('price_list_id' in b) {
    if (b.price_list_id === null || b.price_list_id === '') patch.price_list_id = null
    else if (typeof b.price_list_id === 'string' && /^[0-9a-f-]{36}$/i.test(b.price_list_id)) patch.price_list_id = b.price_list_id
    else return NextResponse.json({ error: 'price_list_id is invalid' }, { status: 400 })
  }
  const { data, error } = await supabase!.from('pos_registers').update(patch).eq('id', b.id).select('*').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Register code already exists' : error.message }, { status: 400 })
  return NextResponse.json({ register: data })
}
