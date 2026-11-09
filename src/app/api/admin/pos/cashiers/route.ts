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

// DELETE ?id= → padam kasyer HANYA jika tiada sejarah (jualan, void, shift, tunai masuk/keluar, pengesahan DO,
// pergerakan stok). Ada sejarah → 409: nyahaktifkan sahaja supaya nama kekal pada rekod lama.
export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const sb = supabase!
  const head = { count: 'exact' as const, head: true }
  const [sales, shifts, cash, transfers, moves] = await Promise.all([
    sb.from('pos_sales').select('id', head).or(`cashier_id.eq.${id},voided_by.eq.${id}`),
    sb.from('pos_shifts').select('id', head).or(`opened_by.eq.${id},closed_by.eq.${id}`),
    sb.from('pos_cash_movements').select('id', head).eq('cashier_id', id),
    sb.from('pos_transfers').select('id', head).eq('confirmed_cashier_id', id),
    sb.from('pos_stock_movements').select('id', head).eq('cashier_id', id),
  ])
  // jadual 157 mungkin belum wujud → count null = 0 (tiada sejarah di situ)
  const parts: [string, number][] = [['sale', sales.count ?? 0], ['shift', shifts.count ?? 0], ['cash movement', cash.count ?? 0], ['delivery order', transfers.count ?? 0], ['stock movement', moves.count ?? 0]]
  const used = parts.filter(([, n]) => n > 0)
  if (used.length > 0) {
    return NextResponse.json({ error: `This cashier appears on ${used.map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`).join(', ')}, so they cannot be deleted. Set them to Inactive to remove them from the PIN screen.` }, { status: 409 })
  }
  const { error } = await sb.from('pos_cashiers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.code === '23503' ? 'This cashier is still referenced by other records. Set them to Inactive instead.' : error.message }, { status: error.code === '23503' ? 409 : 400 })
  return NextResponse.json({ ok: true })
}
