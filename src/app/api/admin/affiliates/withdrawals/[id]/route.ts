import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { getAppSettings } from '@/lib/app-settings'

// PATCH /api/admin/affiliates/withdrawals/[id] — approved / rejected / paid.
// Migration 165: peralihan dikuatkuasakan dalam DB (RPC affiliate_withdrawal_set_status):
//   pending → approved | rejected | paid;  approved → paid | rejected;  paid/rejected muktamad.
// Baki ditolak masa permohonan; 'rejected' pulangkan baki (dalam transaksi yang sama).
// Dulu: rejected → paid dibenarkan (bayar duit yang sudah dipulangkan ke baki).

const RPC_ERR: Record<string, string> = {
  not_found:      'Permintaan tidak dijumpai',
  final:          'Permintaan ini sudah muktamad (dibayar/ditolak)',
  bad_status:     'Status tidak sah',
  bad_transition: 'Peralihan status tidak dibenarkan',
}

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

    const { error } = await supabase.rpc('affiliate_withdrawal_set_status', {
      p_id: id, p_status: status, p_note: typeof admin_note === 'string' ? admin_note : null,
    })
    if (error) {
      const key = Object.keys(RPC_ERR).find(k => (error.message ?? '').includes(k))
      return NextResponse.json({ error: key ? RPC_ERR[key] : error.message }, { status: key ? 400 : 500 })
    }

    // Maklum affiliate bila dibayar/ditolak — hanya jika tetapan WA affiliate dihidupkan (lalai off).
    if (status === 'paid' || status === 'rejected') {
      const settings = await getAppSettings().catch(() => ({} as Record<string, string>))
      if (settings['affiliate_notify_wa'] === 'on') {
        const { data } = await supabase
          .from('affiliate_withdrawals')
          .select('amount, admin_note, affiliate:profiles!affiliate_withdrawals_affiliate_id_fkey(full_name, phone)')
          .eq('id', id).maybeSingle()
        type WdRow = { amount: number | string; admin_note: string | null; affiliate: { full_name: string | null; phone: string | null } | null }
        const wd = data as unknown as WdRow | null
        if (wd?.affiliate?.phone) {
          const amt = Number(wd.amount ?? 0).toFixed(2)
          const msg = status === 'paid'
            ? `Pengeluaran komisen RM${amt} telah dibayar ke akaun bank anda.`
            : `Permintaan pengeluaran RM${amt} tidak dapat diproses; baki dipulangkan ke akaun affiliate anda.${wd.admin_note ? `\nNota: ${wd.admin_note}` : ''}`
          sendWhatsApp(wd.affiliate.phone, msg).catch(() => {})
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error)?.message ?? 'Server error' }, { status: 500 })
  }
}
