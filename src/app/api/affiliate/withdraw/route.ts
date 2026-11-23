import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'

// POST /api/affiliate/withdraw — permohonan pengeluaran komisen.
// Migration 165: semak baki + tolak + insert dalam SATU transaksi (RPC
// affiliate_request_withdrawal, service_role sahaja) — tiada lagi dua langkah
// yang boleh berlumba dengan kredit cron. Minimum ikut app_settings.affiliate_min_withdraw.

const RPC_ERR: Record<string, string> = {
  not_affiliate:  'Akaun ini bukan affiliate',
  min_amount:     'Amaun di bawah minimum pengeluaran',
  pending_exists: 'Ada permintaan pengeluaran yang sedang diproses',
  insufficient:   'Baki tidak mencukupi',
}

export async function POST(request: Request) {
  try {
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { bank_name, bank_account, account_name } = body
    const amount = typeof body.amount === 'number' && isFinite(body.amount) ? Math.round(body.amount * 100) / 100 : null

    if (!amount || amount <= 0) return NextResponse.json({ error: 'Amaun tidak sah' }, { status: 400 })
    if (amount > 50000) return NextResponse.json({ error: 'Amaun melebihi had' }, { status: 400 })
    if (!bank_name || typeof bank_name !== 'string' || bank_name.trim().length < 2) return NextResponse.json({ error: 'Nama bank tidak sah' }, { status: 400 })
    if (!bank_account || typeof bank_account !== 'string' || !/^\d{6,20}$/.test(bank_account.trim())) return NextResponse.json({ error: 'No. akaun bank tidak sah' }, { status: 400 })
    if (!account_name || typeof account_name !== 'string' || account_name.trim().length < 3) return NextResponse.json({ error: 'Nama pemilik akaun tidak lengkap' }, { status: 400 })

    const supabase = createAdminClient()
    const { data: wdId, error } = await supabase.rpc('affiliate_request_withdrawal', {
      p_affiliate: user.id,
      p_amount: amount,
      p_bank: bank_name.trim(),
      p_account: bank_account.trim(),
      p_name: account_name.trim(),
    })
    if (error) {
      const key = Object.keys(RPC_ERR).find(k => (error.message ?? '').includes(k))
      return NextResponse.json({ error: key ? RPC_ERR[key] : 'Permintaan gagal. Cuba lagi.' }, { status: key ? 400 : 500 })
    }

    // Maklum admin (nombor dalaman) — best-effort
    const adminPhone = process.env.ADMIN_WHATSAPP
    if (adminPhone) {
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const name = prof?.full_name ?? 'Affiliate'
      sendWhatsApp(adminPhone, [
        `Permintaan pengeluaran affiliate`,
        `${name} — RM${amount.toFixed(2)}`,
        `${bank_name.trim()} ${bank_account.trim()} (${account_name.trim()})`,
        `Semak: panel admin → Affiliate → Pengeluaran`,
      ].join('\n')).catch(() => {})
    }

    return NextResponse.json({ ok: true, id: wdId })
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message ?? 'Server error' }, { status: 500 })
  }
}
