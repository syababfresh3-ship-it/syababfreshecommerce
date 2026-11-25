import { NextResponse } from 'next/server'
import { requirePos } from '@/lib/pos/require-pos'
import { loadOpenShift } from '@/lib/pos/shifts'
import { round2 } from '@/lib/pos/money'
import { POS_SETTLE_METHODS, type PosPayMethod } from '@/lib/pos/types'

// Selesaikan hutang kredit satu jualan (migration 170): wang sebenar diterima (tunai/QR/kad/e-wallet) → baris bayaran
// baharu dengan settles_payment_id → baris 'credit' ditanda settled_at. Penyelesaian PENUH sahaja (jumlah = baki kredit).
// Bayaran bawa shift_id shift terbuka register penerima → laci tunai shift itu betul; paid_total jualan tidak berubah
// (kredit sudah dikira "paid" semasa barang dilepaskan).
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePos({ cashier: true })
  if (auth.forbidden) return auth.forbidden
  const { id } = await params
  const sb = auth.supabase!
  const body = await request.json().catch(() => ({}))
  const method = body.method as PosPayMethod
  if (!POS_SETTLE_METHODS.includes(method)) return NextResponse.json({ error: 'Invalid method' }, { status: 400 })

  const { data: sale } = await sb.from('pos_sales').select('id, status, register_id, receipt_no').eq('id', id).maybeSingle()
  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  if (sale.status !== 'paid') return NextResponse.json({ error: `Sale is ${sale.status}` }, { status: 409 })

  const { data: credits, error: ce } = await sb.from('pos_payments').select('id, amount').eq('sale_id', id).eq('method', 'credit').eq('status', 'paid').is('settled_at', null)
  if (ce) return NextResponse.json({ error: ce.code === '42703' ? 'Migration 170 (POS pickup/credit) has not been run' : ce.message }, { status: ce.code === '42703' ? 503 : 500 })
  const outstanding = round2((credits ?? []).reduce((s, c) => s + Number(c.amount), 0))
  if (!credits?.length || outstanding <= 0) return NextResponse.json({ error: 'No outstanding credit on this sale' }, { status: 409 })

  const UUID_RE = /^[0-9a-f-]{36}$/i
  const registerId = typeof body.register_id === 'string' && UUID_RE.test(body.register_id) ? body.register_id : sale.register_id
  const shift = await loadOpenShift(sb, registerId).catch(() => null)
  const now = new Date().toISOString()
  const { data: ins, error } = await sb.from('pos_payments').insert({
    sale_id: id, method, amount: outstanding,
    tendered: body.tendered != null ? round2(Number(body.tendered)) : null,
    change_given: body.change_given != null ? round2(Number(body.change_given)) : null,
    ref: typeof body.ref === 'string' ? body.ref.trim().slice(0, 80) || null : null,
    status: 'paid', paid_at: now, shift_id: shift?.id ?? null, settles_payment_id: credits[0].id,
  }).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await sb.from('pos_payments').update({ settled_at: now }).in('id', credits.map(c => c.id))
  return NextResponse.json({ ok: true, settled: outstanding, payment_id: ins?.id ?? null, shift_id: shift?.id ?? null, receipt_no: sale.receipt_no })
}
