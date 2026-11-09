import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { ShiftError, buildShiftSummary, loadLastClosedShift, loadOpenShift, openShift } from '@/lib/pos/shifts'

// Shift register (buka/tutup kedai). GET ?register=<id> → { shift|null, summary? (langsung, laporan X), last? }
// POST { register_id, opening_float, note? } → buka kedai (PIN kasyer mana-mana peranan, atau admin).
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const sb = auth.supabase!
  const register = new URL(request.url).searchParams.get('register')
  if (!register) return NextResponse.json({ shift: null, last: null })
  try {
    const shift = await loadOpenShift(sb, register)
    if (shift) return NextResponse.json({ shift, summary: await buildShiftSummary(sb, shift) })
    return NextResponse.json({ shift: null, last: await loadLastClosedShift(sb, register) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  if (!auth.cashier && !auth.isAdmin) return NextResponse.json({ error: 'Cashier PIN required', code: 'PIN_REQUIRED' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  try {
    const shift = await openShift(auth.supabase!, { registerId: String(b.register_id ?? ''), openingFloat: Number(b.opening_float ?? 0), cashierId: auth.cashier?.id ?? null, note: typeof b.note === 'string' ? b.note : null })
    return NextResponse.json({ shift, summary: await buildShiftSummary(auth.supabase!, shift) }, { status: 201 })
  } catch (e) {
    if (e instanceof ShiftError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
