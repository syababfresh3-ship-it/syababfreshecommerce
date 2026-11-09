import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { restorePosSaleStock } from '@/lib/pos/stock'
import { isValidPin, verifyPin } from '@/lib/pos/pin'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'

// Void jualan — dibenarkan untuk admin, kasyer manager, atau PIN manager (body.manager_id +
// body.manager_pin) yang disahkan di sini. Stok dipulangkan sekali (restorePosSaleStock).
// Promo: best-effort, tidak diundur.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const { id } = await params
  const sb = auth.supabase!
  const body = await request.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''
  if (!reason) return NextResponse.json({ error: 'Void reason required' }, { status: 400 })

  let approvedBy: string | null = auth.cashier?.id ?? null
  const allowed = auth.isAdmin || auth.cashier?.role === 'manager'
  if (!allowed) {
    const ok = await rateLimitDb(`pos-pin:${clientIp(request)}`, 10, 60_000)
    if (!ok) return NextResponse.json({ error: 'Too many PIN attempts' }, { status: 429 })
    const managerId = typeof body.manager_id === 'string' ? body.manager_id : ''
    if (!managerId || !isValidPin(body.manager_pin)) return NextResponse.json({ error: 'Manager PIN required', code: 'MANAGER_REQUIRED' }, { status: 403 })
    const { data: m } = await sb.from('pos_cashiers').select('id, role, pin_hash, is_active').eq('id', managerId).maybeSingle()
    if (!m || !m.is_active || m.role !== 'manager' || !verifyPin(body.manager_pin, m.pin_hash)) return NextResponse.json({ error: 'Wrong manager PIN', code: 'MANAGER_REQUIRED' }, { status: 403 })
    approvedBy = m.id
  }

  const { data: rows, error } = await sb
    .from('pos_sales')
    .update({ status: 'void', voided_at: new Date().toISOString(), voided_by: approvedBy, void_reason: reason })
    .eq('id', id)
    .in('status', ['paid', 'pending'])
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.[0]) return NextResponse.json({ error: 'Sale not found or already void' }, { status: 409 })

  await sb.from('pos_payments').update({ status: 'cancelled' }).eq('sale_id', id).eq('status', 'pending')
  const stock = await restorePosSaleStock(sb, id)
  return NextResponse.json({ ok: true, stock })
}
