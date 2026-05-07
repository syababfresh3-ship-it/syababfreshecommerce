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

    const body = await request.json()
    const { bank_name, bank_account, account_name } = body
    const amount = typeof body.amount === 'number' && isFinite(body.amount) ? body.amount : null

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amaun tidak sah' }, { status: 400 })
    if (amount < 10) return NextResponse.json({ error: 'Minimum pengeluaran RM10' }, { status: 400 })
    if (amount > 50000) return NextResponse.json({ error: 'Amaun melebihi had' }, { status: 400 })
    if (amount > profile.affiliate_balance) return NextResponse.json({ error: 'Baki tidak mencukupi' }, { status: 400 })
    if (!bank_name || typeof bank_name !== 'string' || bank_name.trim().length < 2) return NextResponse.json({ error: 'Nama bank tidak sah' }, { status: 400 })
    if (!bank_account || typeof bank_account !== 'string' || !/^\d{6,20}$/.test(bank_account.trim())) return NextResponse.json({ error: 'No. akaun bank tidak sah' }, { status: 400 })
    if (!account_name || typeof account_name !== 'string' || account_name.trim().length < 3) return NextResponse.json({ error: 'Nama pemilik akaun tidak lengkap' }, { status: 400 })

    // Check no pending withdrawal already
    const { data: pending } = await supabase
      .from('affiliate_withdrawals')
      .select('id')
      .eq('affiliate_id', user.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pending) return NextResponse.json({ error: 'Ada permintaan pengeluaran yang sedang diproses' }, { status: 400 })

    // Atomic balance deduction — WHERE affiliate_balance >= amount prevents race condition
    const { data: deducted, error: deductErr } = await supabase
      .from('profiles')
      .update({ affiliate_balance: profile.affiliate_balance - amount })
      .eq('id', user.id)
      .gte('affiliate_balance', amount)
      .select('id')
      .single()

    if (deductErr || !deducted) {
      return NextResponse.json({ error: 'Baki tidak mencukupi' }, { status: 400 })
    }

    const { error } = await supabase.from('affiliate_withdrawals').insert({
      affiliate_id: user.id,
      amount,
      bank_name: bank_name.trim(),
      bank_account: bank_account.trim(),
      account_name: account_name.trim(),
      status: 'pending',
    })

    if (error) {
      // Rollback balance deduction if withdrawal insert fails
      await supabase.from('profiles')
        .update({ affiliate_balance: profile.affiliate_balance })
        .eq('id', user.id)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 })
  }
}
