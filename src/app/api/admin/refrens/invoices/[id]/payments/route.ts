export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Bayaran invois Refrens: GET senarai, POST rekod { amount, paymentDate (YYYY-MM-DD), paymentMethod, refId?, notes? }.
// Tulis ke akaun Refrens SEBENAR (tiada sandbox). Idempotency-Key = id invois + tarikh + jumlah + rujukan.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { PAYMENT_METHODS, RefrensError, isRefrensConfigured, listPayments, recordPayment, type PaymentMethod } from '@/lib/refrens'

type Ctx = { params: Promise<{ id: string }> }
const ID_RE = /^[0-9a-f]{24}$/i
const errJson = (e: unknown) => e instanceof RefrensError
  ? NextResponse.json({ error: e.message, refrens: e.body }, { status: e.status >= 500 ? 502 : e.status === 503 ? 503 : 400 })
  : NextResponse.json({ error: (e as Error).message ?? 'Ralat' }, { status: 500 })

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'ID tidak sah' }, { status: 400 })
  if (!isRefrensConfigured()) return NextResponse.json({ error: 'Refrens belum dikonfigurasi' }, { status: 503 })
  try { return NextResponse.json({ payments: await listPayments(id) }) } catch (e) { return errJson(e) }
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params
  const { user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  if (!ID_RE.test(id)) return NextResponse.json({ error: 'ID tidak sah' }, { status: 400 })
  if (!isRefrensConfigured()) return NextResponse.json({ error: 'Refrens belum dikonfigurasi' }, { status: 503 })
  const b = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Jumlah bayaran mesti lebih dari 0' }, { status: 400 })
  const date = typeof b.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.paymentDate) ? b.paymentDate : null
  if (!date) return NextResponse.json({ error: 'Tarikh bayaran tidak sah' }, { status: 400 })
  const method = typeof b.paymentMethod === 'string' && (PAYMENT_METHODS as readonly string[]).includes(b.paymentMethod) ? b.paymentMethod as PaymentMethod : null
  if (!method) return NextResponse.json({ error: 'Kaedah bayaran tidak sah' }, { status: 400 })
  const refId = typeof b.refId === 'string' ? b.refId.trim() : ''
  const notes = typeof b.notes === 'string' ? b.notes.trim() : ''
  const key = `pay-${id}-${date}-${amount.toFixed(2)}-${refId || 'noref'}`.slice(0, 255)
  try {
    const payment = await recordPayment(id, { amount, paymentDate: new Date(date + 'T12:00:00Z').toISOString(), paymentMethod: method, refId, notes: notes ? `${notes} (admin: ${user?.email ?? '-'})` : `Direkod dari admin website (${user?.email ?? '-'})` }, key)
    return NextResponse.json({ ok: true, payment }, { status: 201 })
  } catch (e) { return errJson(e) }
}
