import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/admin/affiliates/withdrawals/[id] — approve/reject/mark paid
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!me?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { status, admin_note } = await request.json()
    if (!['approved', 'rejected', 'paid'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak sah' }, { status: 400 })
    }

    const { data: wd } = await supabase
      .from('affiliate_withdrawals')
      .select('affiliate_id, amount, status')
      .eq('id', id)
      .single()

    if (!wd) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })

    const update: Record<string, any> = { status, processed_at: new Date().toISOString() }
    if (admin_note !== undefined) update.admin_note = admin_note

    const { error } = await supabase.from('affiliate_withdrawals').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Deduct balance when paid (balance is source of truth)
    if (status === 'paid' && wd.status !== 'paid') {
      await supabase.rpc('increment_affiliate_balance', {
        uid: wd.affiliate_id,
        amt: -wd.amount,
      })
    }

    // Restore balance if rejected after already paid
    if (status === 'rejected' && wd.status === 'paid') {
      await supabase.rpc('increment_affiliate_balance', {
        uid: wd.affiliate_id,
        amt: wd.amount,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
