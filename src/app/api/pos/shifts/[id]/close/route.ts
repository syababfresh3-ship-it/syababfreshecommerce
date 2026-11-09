import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { ShiftError, closeShift } from '@/lib/pos/shifts'
import { sendAdminPush } from '@/lib/push'
import { rm } from '@/lib/pos/money'

// Tutup kedai: body { counted_cash, declared?: { duitnow_qr?, card_terminal?, ewallet_terminal? }, note? } → Z dibekukan
// (tunai dijangka vs dikira + jumlah diisytihar per kaedah vs rekod sistem). PIN kasyer (staf bertugas) atau admin.
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  if (!auth.cashier && !auth.isAdmin) return NextResponse.json({ error: 'Cashier PIN required', code: 'PIN_REQUIRED' }, { status: 401 })
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  if (b.counted_cash === undefined || b.counted_cash === null || b.counted_cash === '') return NextResponse.json({ error: 'Counted cash is required' }, { status: 400 })
  try {
    const shift = await closeShift(auth.supabase!, id, { countedCash: Number(b.counted_cash), cashierId: auth.cashier?.id ?? null, note: typeof b.note === 'string' ? b.note : null, declared: b.declared && typeof b.declared === 'object' ? b.declared : null })
    const v = shift.variance ?? 0
    const other = Object.entries(shift.summary?.tenderVariance ?? {}).filter(([m, d]) => m !== 'cash' && Number(d) !== 0).reduce((a, [, d]) => a + Number(d), 0)
    sendAdminPush({ title: `Kedai ditutup: ${shift.pos_registers?.code ?? 'POS'}`, body: `Jualan ${rm(shift.summary?.revenue ?? 0)} (${shift.summary?.sales ?? 0}) · tunai ${v === 0 ? 'tepat' : `${v > 0 ? 'lebih' : 'kurang'} ${rm(Math.abs(v))}`}${other !== 0 ? ` · QR/kad ${other > 0 ? 'lebih' : 'kurang'} ${rm(Math.abs(other))}` : ''}`, url: '/admin/pos/shifts', tag: 'pos-shift' }).catch(() => {})
    return NextResponse.json({ shift, summary: shift.summary })
  } catch (e) {
    if (e instanceof ShiftError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 })
  }
}
