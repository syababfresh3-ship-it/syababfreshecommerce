import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { hashPin, isValidPin } from '@/lib/pos/pin'

// Kasyer POS (admin). GET senarai (tanpa hash) · POST { name, role, pin } · PATCH { id, name?, role?, is_active?, pin? (reset) }
export const dynamic = 'force-dynamic'

const COLS = 'id, name, role, is_active, failed_attempts, locked_until, created_at'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data, error } = await supabase!.from('pos_cashiers').select(COLS).order('name')
  if (error) return NextResponse.json({ error: error.message, cashiers: [] }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })
  return NextResponse.json({ cashiers: data ?? [], pinEnabled: !!process.env.POS_PIN_SECRET })
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!isValidPin(b.pin)) return NextResponse.json({ error: 'A 4–6 digit PIN is required' }, { status: 400 })
  const role = b.role === 'manager' ? 'manager' : 'cashier'
  const { data, error } = await supabase!.from('pos_cashiers').insert({ name, role, pin_hash: hashPin(b.pin) }).select(COLS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ cashier: data })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  if (typeof b.id !== 'string') return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 60)
  if (b.role === 'manager' || b.role === 'cashier') patch.role = b.role
  if (typeof b.is_active === 'boolean') patch.is_active = b.is_active
  if (b.pin != null) {
    if (!isValidPin(b.pin)) return NextResponse.json({ error: 'PIN must be 4–6 digits' }, { status: 400 })
    patch.pin_hash = hashPin(b.pin); patch.failed_attempts = 0; patch.locked_until = null
  }
  if (b.unlock === true) { patch.failed_attempts = 0; patch.locked_until = null }
  const { data, error } = await supabase!.from('pos_cashiers').update(patch).eq('id', b.id).select(COLS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ cashier: data })
}
