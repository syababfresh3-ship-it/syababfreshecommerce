import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createAdminClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_affiliate, affiliate_balance')
      .eq('id', user.id)
      .single()

    if (!profile?.is_affiliate) return NextResponse.json({ error: 'Bukan affiliate' }, { status: 403 })

    const { amount, bank_name, bank_account, account_name } = await request.json()

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amaun tidak sah' }, { status: 400 })
    if (amount < 10) return NextResponse.json({ error: 'Minimum pengeluaran RM10' }, { status: 400 })
    if (amount > profile.affiliate_balance) return NextResponse.json({ error: 'Baki tidak mencukupi' }, { status: 400 })
    if (!bank_name || !bank_account || !account_name) return NextResponse.json({ error: 'Maklumat bank tidak lengkap' }, { status: 400 })

    // Check no pending withdrawal already
    const { data: pending } = await supabase
      .from('affiliate_withdrawals')
      .select('id')
      .eq('affiliate_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pending) return NextResponse.json({ error: 'Ada permintaan pengeluaran yang sedang diproses' }, { status: 400 })

    const { error } = await supabase.from('affiliate_withdrawals').insert({
      affiliate_id: user.id,
      amount,
      bank_name,
      bank_account,
      account_name,
      status: 'pending',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
