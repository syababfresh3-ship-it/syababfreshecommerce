import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPaymentReminderEmail } from '@/lib/zeptomail'
import { stampHeartbeat } from '@/lib/cron-heartbeat'

// Abandoned-payment reminder. Dipanggil oleh scheduler luar (GitHub Actions tiap
// ~30 min) sebab Vercel Hobby cron hanya sekali/hari. Cari order FPX/e-wallet
// yang masih unpaid 1–24 jam selepas dibuat & belum diingatkan → hantar 1 email
// dengan link bayar semula (/api/pay/[id]), kemudian stamp payment_reminder_sent_at
// supaya tak hantar berulang. Tetingkap 24 jam = elak spam order lama.

const REMIND_AFTER_MS = 60 * 60 * 1000        // 1 jam
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000  // 24 jam

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://shop.syababfresh.my'
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const now = Date.now()
  const upperBound = new Date(now - REMIND_AFTER_MS).toISOString()  // dibuat <= 1 jam lalu
  const lowerBound = new Date(now - GIVE_UP_AFTER_MS).toISOString() // dibuat >= 24 jam lalu
  const stamp = new Date(now).toISOString()

  type Candidate = { id: string; order_number: string; total: number; to: string; name: string; table: 'orders' | 'lp_guest_orders' }
  const candidates: Candidate[] = []

  // ── Storefront orders (email + nama dari profiles) ───────────────────
  const { data: sf } = await supabase
    .from('orders')
    .select('id, order_number, total, user_id, payment_method, payment_status, status, created_at, payment_reminder_sent_at')
    .eq('status', 'pending')
    .eq('payment_status', 'unpaid')
    .in('payment_method', ['fpx', 'ewallet'])
    .is('payment_reminder_sent_at', null)
    .lte('created_at', upperBound)
    .gte('created_at', lowerBound)

  if (sf?.length) {
    const userIds = [...new Set(sf.map(o => o.user_id).filter(Boolean))]
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
    const pMap = new Map((profiles ?? []).map(p => [p.id, p]))
    for (const o of sf) {
      const p = pMap.get(o.user_id)
      if (p?.email) candidates.push({ id: o.id, order_number: o.order_number, total: Number(o.total), to: p.email, name: p.full_name || 'pelanggan', table: 'orders' })
    }
  }

  // ── LP guest orders (email + nama pada baris sendiri) ────────────────
  const { data: lp } = await supabase
    .from('lp_guest_orders')
    .select('id, order_number, total, name, email, payment_method, payment_status, status, created_at, payment_reminder_sent_at')
    .eq('status', 'pending')
    .eq('payment_status', 'unpaid')
    .in('payment_method', ['fpx', 'ewallet'])
    .is('payment_reminder_sent_at', null)
    .lte('created_at', upperBound)
    .gte('created_at', lowerBound)

  for (const o of lp ?? []) {
    if (o.email) candidates.push({ id: o.id, order_number: o.order_number, total: Number(o.total), to: o.email, name: o.name || 'pelanggan', table: 'lp_guest_orders' })
  }

  // ── Hantar + stamp (best-effort; stamp walau email gagal supaya tak spam) ─
  let sent = 0
  for (const c of candidates) {
    await sendPaymentReminderEmail({
      to: c.to,
      customerName: c.name,
      orderNumber: c.order_number,
      total: c.total,
      payUrl: `${appUrl()}/api/pay/${c.id}`,
    })
    await supabase.from(c.table).update({ payment_reminder_sent_at: stamp }).eq('id', c.id)
    sent++
  }

  console.log(`[payment-reminder] sent ${sent} (sf=${sf?.length ?? 0}, lp=${lp?.length ?? 0})`)
  await stampHeartbeat(supabase, 'payment-reminder')
  return NextResponse.json({ sent, candidates: candidates.length })
}
