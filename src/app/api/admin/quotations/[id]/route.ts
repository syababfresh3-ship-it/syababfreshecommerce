export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sebut harga: GET (+events), PATCH (edit — hanya draft/issued), DELETE (draf sahaja).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadEvents, loadQuotation, logQuotationEvent, parseQuotationInput, rowToQuotation, syncCustomer, totalsFor } from '@/lib/quotation-server'
import { invoiceRefFromEvents, isEditable, isExpired, refrensQuotationRefFromEvents } from '@/lib/quotation'
import { isRefrensConfigured } from '@/lib/refrens'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = await loadQuotation(supabase!, id)
  if (!q) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  const events = await loadEvents(supabase!, id)
  let deal: { id: string; stage: string } | null = null
  try { const { data } = await supabase!.from('gift_deals').select('id, stage').eq('quotation_id', id).maybeSingle(); deal = data ?? null } catch { /* migration 147 belum */ }
  return NextResponse.json({ ...q, expired: isExpired(q), events, invoice: invoiceRefFromEvents(events), refrens_quotation: refrensQuotationRefFromEvents(events), refrens_configured: isRefrensConfigured(), deal })
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const cur = await loadQuotation(supabase!, id)
  if (!cur) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  if (!isEditable(cur)) return NextResponse.json({ error: 'Sebut harga ini dikunci (sudah diterima/dibatalkan). Guna Duplicate untuk versi baharu.' }, { status: 409 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })
  const parsed = parseQuotationInput(body, true)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const d = parsed.data

  const items = d.items ?? cur.items
  const discount = d.discount ?? cur.discount
  const charges = d.charges ?? cur.charges
  const totals = totalsFor(items, discount, charges)
  const client = d.client ?? cur.client
  const customerId = d.customer_id !== undefined ? d.customer_id : cur.customer_id
  const syncedId = await syncCustomer(supabase!, client, customerId)

  const update = {
    ...d, client, customer_id: syncedId ?? customerId, items, charges,
    subtotal: totals.subtotal, discount: totals.discount, total: totals.total,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase!.from('quotations').update(update).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logQuotationEvent(supabase!, id, 'edited', { fields: Object.keys(d) }, user?.email ?? null)
  return NextResponse.json(rowToQuotation(data))
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const cur = await loadQuotation(supabase!, id)
  if (!cur) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  if (cur.status !== 'draft') return NextResponse.json({ error: 'Hanya draf boleh dipadam. Gunakan Batal untuk sebut harga yang dikeluarkan.' }, { status: 409 })
  const { error } = await supabase!.from('quotations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
