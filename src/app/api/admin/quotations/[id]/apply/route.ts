export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → tulis jumlah sebut harga ke gift order sumber (total, unit_price, deposit/baki)
// + status quoted jika masih enquiry. Sama kesan dengan "Save quote" di /admin/kurma/[id];
// pautan bayar deposit CHIP sedia ada terus guna angka baharu.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadQuotation, logQuotationEvent } from '@/lib/quotation-server'

const r2 = (n: number) => Math.round(n * 100) / 100

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = await loadQuotation(supabase!, id)
  if (!q) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  if (q.source_type !== 'gift_order' || !q.source_id) return NextResponse.json({ error: 'Sebut harga ini tidak berpaut pada gift order' }, { status: 409 })
  if (!['issued', 'accepted'].includes(q.status)) return NextResponse.json({ error: 'Keluarkan sebut harga dahulu' }, { status: 409 })

  const { data: o } = await supabase!.from('gift_orders').select('id, order_number, status, deposit_pct, delivery_fee, quantity, admin_notes').eq('id', q.source_id).maybeSingle()
  if (!o) return NextResponse.json({ error: 'Gift order tidak dijumpai' }, { status: 404 })

  const pct = Number(o.deposit_pct) || 50
  const total = r2(q.total)
  const deposit = r2(total * pct / 100)
  const boxLine = q.items.find(i => i.unit === 'box') ?? q.items[0]
  const stamp = new Date().toISOString()
  const note = `[${stamp.slice(0, 10)}] Quotation ${q.quote_number} applied: total RM${total.toFixed(2)}`
  const update: Record<string, unknown> = {
    total, subtotal: r2(q.subtotal), unit_price: r2(boxLine?.rate ?? 0),
    deposit_amount: deposit, balance: r2(total - deposit),
    admin_notes: o.admin_notes ? `${o.admin_notes}\n${note}` : note,
    updated_at: stamp,
  }
  if (o.status === 'enquiry') update.status = 'quoted'
  const { error } = await supabase!.from('gift_orders').update(update).eq('id', o.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logQuotationEvent(supabase!, id, 'applied_gift_order', { order_number: o.order_number, total, deposit }, user?.email ?? null)
  return NextResponse.json({ ok: true, order_number: o.order_number, total, deposit, balance: r2(total - deposit) })
}
