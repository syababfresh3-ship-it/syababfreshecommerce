export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST { kind: deposit|balance, amount, date (YYYY-MM-DD), method, ref?, also_refrens? } → tanda bayaran manual
// (pilihan: rekod juga pada invois Refrens berpaut). Peringkat maju automatik.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadDeal, loadDealRow, recordDealPayment } from '@/lib/gift-deals-server'
import { PAY_METHODS } from '@/lib/gift-deals'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const d = await loadDeal(supabase!, id)
  if (!d) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  const b = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })
  const kind = b.kind === 'balance' ? 'balance' : b.kind === 'deposit' ? 'deposit' : null
  if (!kind) return NextResponse.json({ error: 'Jenis bayaran tidak sah' }, { status: 400 })
  const amount = Number(b.amount)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Jumlah mesti lebih dari 0' }, { status: 400 })
  const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null
  if (!date) return NextResponse.json({ error: 'Tarikh tidak sah' }, { status: 400 })
  const method = typeof b.method === 'string' && PAY_METHODS.some(([v]) => v === b.method) ? b.method : 'ACCOUNT_TRANSFER'
  const ref = typeof b.ref === 'string' ? b.ref.trim().slice(0, 120) || null : null
  try {
    const row = await loadDealRow(supabase!, id)
    const res = await recordDealPayment(supabase!, d, row?.invoice ?? null, { kind, amount, date, method, ref, also_refrens: b.also_refrens === true }, user?.email ?? null)
    return NextResponse.json({ ok: true, refrens: res.refrens, deal: await loadDealRow(supabase!, id) })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
