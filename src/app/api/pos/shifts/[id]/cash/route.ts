import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { ShiftError, addCashMovement, buildShiftSummary, loadShift } from '@/lib/pos/shifts'

// Tunai masuk / keluar laci semasa shift: body { type: 'in'|'out', amount, reason }. PIN kasyer atau admin.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  if (!auth.cashier && !auth.isAdmin) return NextResponse.json({ error: 'Cashier PIN required', code: 'PIN_REQUIRED' }, { status: 401 })
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  if (b.type !== 'in' && b.type !== 'out') return NextResponse.json({ error: 'type must be in or out' }, { status: 400 })
  try {
    await addCashMovement(auth.supabase!, id, { type: b.type, amount: Number(b.amount), reason: typeof b.reason === 'string' ? b.reason : null, cashierId: auth.cashier?.id ?? null })
    const shift = (await loadShift(auth.supabase!, id))!
    return NextResponse.json({ shift, summary: await buildShiftSummary(auth.supabase!, shift) })
  } catch (e) {
    if (e instanceof ShiftError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
