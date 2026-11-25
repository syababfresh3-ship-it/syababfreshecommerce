import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { markSalePaid, PosSaleError } from '@/lib/pos/sale'
import { round2, roundCash05 } from '@/lib/pos/money'
import { POS_TENDER_METHODS, type PosPayMethod } from '@/lib/pos/types'
import { loadOpenShift } from '@/lib/pos/shifts'

// Tambah bayaran pada jualan `pending` (pautan CHIP ditukar ke tunai/terminal, sahkan manual oleh manager, atau
// order PICKUP dibayar di kaunter — migration 170). Bila jumlah bayaran paid ≥ total → jualan jadi paid (kesan sampingan sekali).
// 170: bayaran bawa shift_id shift terbuka register yang menerima (body.register_id / register jualan) supaya laci tunai
// shift itu betul; placeholder 'pickup' pending dibatalkan; tender 'credit' dibenarkan (perlu telefon pelanggan).
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos({ cashier: true })
  if (auth.forbidden) return auth.forbidden
  const { id } = await params
  const sb = auth.supabase!
  const body = await request.json().catch(() => ({}))

  const method = body.method as PosPayMethod
  const amount = Number(body.amount)
  if (!POS_TENDER_METHODS.includes(method) || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Invalid method or amount' }, { status: 400 })

  const { data: sale } = await sb.from('pos_sales').select('id, status, total, rounding_adj, register_id, customer_phone').eq('id', id).maybeSingle()
  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  if (sale.status !== 'pending') return NextResponse.json({ error: `Sale is already ${sale.status}` }, { status: 409 })
  // Tunai: baki dibundar 5 sen (order pickup dikira tanpa pembundaran) — total & rounding_adj jualan dilaras seperti computeTotals
  let total = Number(sale.total)
  if (method === 'cash') {
    const { data: prior } = await sb.from('pos_payments').select('amount').eq('sale_id', id).eq('status', 'paid')
    const due = round2(total - (prior ?? []).reduce((s, p) => s + Number(p.amount), 0))
    const { rounded, adj } = roundCash05(due)
    if (adj !== 0 && Math.abs(amount - rounded) < 0.011) {
      total = round2(total + adj)
      await sb.from('pos_sales').update({ total, rounding_adj: round2(Number(sale.rounding_adj ?? 0) + adj) }).eq('id', id)
    }
  }
  if (method === 'credit' && !sale.customer_phone) return NextResponse.json({ error: 'Credit needs a customer phone number on this sale', code: 'CUSTOMER_REQUIRED' }, { status: 400 })

  const UUID_RE = /^[0-9a-f-]{36}$/i
  const registerId = typeof body.register_id === 'string' && UUID_RE.test(body.register_id) ? body.register_id : sale.register_id
  const shift = await loadOpenShift(sb, registerId).catch(() => null)

  // Placeholder 'pickup' sentiasa dibatalkan bila bayaran sebenar masuk; bayaran pending lain (CHIP) bila replace_pending
  await sb.from('pos_payments').update({ status: 'cancelled' }).eq('sale_id', id).eq('status', 'pending').eq('method', 'pickup')
  if (body.replace_pending === true) await sb.from('pos_payments').update({ status: 'cancelled' }).eq('sale_id', id).eq('status', 'pending')

  const row = {
    sale_id: id, method, amount: round2(amount),
    tendered: body.tendered != null ? round2(Number(body.tendered)) : null,
    change_given: body.change_given != null ? round2(Number(body.change_given)) : null,
    ref: typeof body.ref === 'string' ? body.ref.trim().slice(0, 80) || null : null,
    status: 'paid', paid_at: new Date().toISOString(),
  }
  let { error } = await sb.from('pos_payments').insert({ ...row, shift_id: shift?.id ?? null })
  if (error?.code === '42703') ({ error } = await sb.from('pos_payments').insert(row))   // pra-170: tiada lajur shift_id
  if (error?.code === '23514') return NextResponse.json({ error: 'Migration 170 (POS pickup/credit) has not been run' }, { status: 503 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: paid } = await sb.from('pos_payments').select('amount').eq('sale_id', id).eq('status', 'paid')
  const paidTotal = round2((paid ?? []).reduce((s, p) => s + Number(p.amount), 0))
  await sb.from('pos_sales').update({ paid_total: paidTotal }).eq('id', id)

  if (paidTotal + 0.011 >= total) {
    try { await markSalePaid(sb, id, { shiftId: shift?.id ?? null }) } catch (e) { if (e instanceof PosSaleError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e }
    return NextResponse.json({ ok: true, status: 'paid', paid_total: paidTotal })
  }
  return NextResponse.json({ ok: true, status: 'pending', paid_total: paidTotal, remaining: round2(total - paidTotal) })
}
