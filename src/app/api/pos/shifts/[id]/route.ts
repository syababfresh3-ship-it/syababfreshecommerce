import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { buildShiftSummary, loadShift } from '@/lib/pos/shifts'

// Satu shift: { shift, summary } — shift terbuka = ringkasan langsung (X); tertutup = ringkasan beku (Z).
export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos()
  if (auth.forbidden) return auth.forbidden
  const { id } = await params
  const shift = await loadShift(auth.supabase!, id)
  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  const summary = shift.status === 'closed' && shift.summary ? shift.summary : await buildShiftSummary(auth.supabase!, shift)
  return NextResponse.json({ shift, summary })
}
