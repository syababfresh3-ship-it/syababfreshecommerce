import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { createGiftCheckout, type GiftPayKind } from '@/lib/gift-chip'

// GET /api/kurma/pay/[id]?kind=deposit|balance — jana checkout CHIP untuk tempahan gift
// dan redirect terus ke gateway. Dipakai pay-link deposit/baki (admin hantar / resume).
// id = gift_orders.id (UUID) bertindak sebagai token. Lihat lib/gift-chip.ts.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const kind: GiftPayKind = new URL(request.url).searchParams.get('kind') === 'balance' ? 'balance' : 'deposit'
  const sb = createAdminClient()
  const { data: o } = await sb.from('gift_orders')
    .select('id, order_number, name, phone, email, total, deposit_amount, balance, deposit_pct, payment_status, status')
    .eq('id', id).maybeSingle()
  if (!o) return NextResponse.json({ error: 'Tempahan tidak dijumpai' }, { status: 404 })
  if (o.status === 'cancelled') return NextResponse.json({ error: 'Tempahan dibatalkan' }, { status: 400 })

  const amount = kind === 'deposit' ? Number(o.deposit_amount) : Number(o.balance)
  if (kind === 'deposit' && o.payment_status !== 'unpaid') return NextResponse.json({ error: 'Deposit sudah dibayar' }, { status: 400 })
  if (kind === 'balance' && o.payment_status === 'paid') return NextResponse.json({ error: 'Sudah lunas' }, { status: 400 })
  if (!(amount > 0)) return NextResponse.json({ error: 'Tiada jumlah untuk dibayar' }, { status: 400 })

  const res = await createGiftCheckout(o, kind, amount)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: 502 })
  return NextResponse.redirect(res.url, 303)
}
