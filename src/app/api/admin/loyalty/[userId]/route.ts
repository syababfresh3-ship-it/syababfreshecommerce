import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { userId } = await params
  const { points, reason } = await request.json()

  if (!points || points === 0) return NextResponse.json({ error: 'Points required' }, { status: 400 })

  const { error: txError } = await supabase!
    .from('loyalty_transactions')
    .insert({
      user_id: userId,
      points,
      type: 'adjustment',
      description: reason || (points > 0 ? 'Pelarasan manual (tambah)' : 'Pelarasan manual (tolak)'),
    })

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

  const { error: fnError } = await supabase!.rpc('increment_points', { uid: userId, pts: points })
  if (fnError) return NextResponse.json({ error: fnError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
