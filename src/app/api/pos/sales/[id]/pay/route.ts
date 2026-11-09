import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { markSalePaid, PosSaleError } from '@/lib/pos/sale'
import { round2 } from '@/lib/pos/money'
import { POS_PAY_METHODS, type PosPayMethod } from '@/lib/pos/types'

// Tambah bayaran pada jualan `pending` (cth pautan CHIP ditukar ke tunai/terminal, atau sahkan
// manual oleh manager). Bila jumlah bayaran paid ≥ total → jualan jadi paid (kesan sampingan sekali).
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos({ cashier: true })
  if (auth.forbidden) return auth.forbidden
  const { id } = await params
  const sb = auth.supabase!
  const body = await request.json().catch(() => ({}))

  const method = body.method as PosPayMethod
  const amount = Number(body.amount)
  if (!POS_PAY_METHODS.includes(method) || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid method or amount' }, { status: 400 })

  const { data: sale } = await sb.from('pos_sales').select('id, status, total').eq('id', id).maybeSingle()
  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  if (sale.status !== 'pending') return NextResponse.json({ error: `Sale is already ${sale.status}` }, { status: 409 })

  // Batalkan bayaran pending lama (cth pautan CHIP yang tak jadi) bila ganti kaedah
  if (body.replace_pending === true) await sb.from('pos_payments').update({ status: 'cancelled' }).eq('sale_id', id).eq('status', 'pending')

  const { error } = await sb.from('pos_payments').insert({
    sale_id: id, method, amount: round2(amount),
    tendered: body.tendered != null ? round2(Number(body.tendered)) : null,
    change_given: body.change_given != null ? round2(Number(body.change_given)) : null,
    ref: typeof body.ref === 'string' ? body.ref.trim().slice(0, 80) || null : null,
    status: 'paid', paid_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: paid } = await sb.from('pos_payments').select('amount').eq('sale_id', id).eq('status', 'paid')
  const paidTotal = round2((paid ?? []).reduce((s, p) => s + Number(p.amount), 0))
  await sb.from('pos_sales').update({ paid_total: paidTotal }).eq('id', id)

  if (paidTotal + 0.011 >= Number(sale.total)) {
    try { await markSalePaid(sb, id) } catch (e) { if (e instanceof PosSaleError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e }
    return NextResponse.json({ ok: true, status: 'paid', paid_total: paidTotal })
  }
  return NextResponse.json({ ok: true, status: 'pending', paid_total: paidTotal, remaining: round2(Number(sale.total) - paidTotal) })
}
