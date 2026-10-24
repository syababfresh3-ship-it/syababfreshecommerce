export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fasa 2 — invois Refrens dari sebut harga.
// POST ?dry=1 → pulang payload yang AKAN dihantar (tiada tulisan). POST → pastikan klien di Refrens,
// cipta invois, status sebut harga `converted`, rujukan disimpan dalam quotation_events (type 'converted').
// GET → segarkan status/jumlah dari Refrens (event 'invoice_synced'). Tiada webhook Refrens.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadEvents, loadQuotation, logQuotationEvent } from '@/lib/quotation-server'
import { invoiceRefFromEvents } from '@/lib/quotation'
import { RefrensError, createInvoice, ensureClientForQuotation, getInvoice, invoicePayloadFromQuotation, isRefrensConfigured, toInvoiceRef } from '@/lib/refrens'

type Ctx = { params: Promise<{ id: string }> }
const errJson = (e: unknown) => {
  if (e instanceof RefrensError) return NextResponse.json({ error: e.message, refrens: e.body }, { status: e.status >= 500 ? 502 : e.status === 503 ? 503 : 400 })
  return NextResponse.json({ error: (e as Error).message ?? 'Ralat' }, { status: 500 })
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  if (!isRefrensConfigured()) return NextResponse.json({ error: 'Refrens belum dikonfigurasi di pelayan ini (REFRENS_* env)' }, { status: 503 })
  const q = await loadQuotation(supabase!, id)
  if (!q) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  if (!['issued', 'accepted'].includes(q.status)) return NextResponse.json({ error: 'Hanya sebut harga yang dikeluarkan atau diterima boleh dijadikan invois' }, { status: 409 })
  const events = await loadEvents(supabase!, id)
  if (invoiceRefFromEvents(events)) return NextResponse.json({ error: 'Sebut harga ini sudah ada invois Refrens' }, { status: 409 })

  const dry = new URL(request.url).searchParams.get('dry') === '1'
  const payload = invoicePayloadFromQuotation(q)
  if (dry) return NextResponse.json({ dry: true, payload })

  try {
    const { client, created } = await ensureClientForQuotation(q)
    const inv = await createInvoice(payload)
    const ref = toInvoiceRef(inv)
    const now = new Date().toISOString()
    const { error } = await supabase!.from('quotations').update({ status: 'converted', updated_at: now }).eq('id', id)
    if (error) return NextResponse.json({ error: `Invois ${ref.number} dicipta di Refrens tetapi status sebut harga gagal dikemas kini: ${error.message}`, invoice: ref }, { status: 500 })
    await logQuotationEvent(supabase!, id, 'converted', { invoice: ref, client_id: client?._id ?? null, client_created: created }, user?.email ?? null)
    return NextResponse.json({ ok: true, invoice: ref, client_created: created })
  } catch (e) { return errJson(e) }
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const events = await loadEvents(supabase!, id)
  const ref = invoiceRefFromEvents(events)
  if (!ref) return NextResponse.json({ error: 'Tiada invois Refrens untuk sebut harga ini' }, { status: 404 })
  if (!isRefrensConfigured()) return NextResponse.json({ invoice: ref, stale: true })
  try {
    const inv = await getInvoice(ref.id)
    const fresh = toInvoiceRef(inv, ref.created_at)
    if (fresh.status !== ref.status || fresh.total !== ref.total) await logQuotationEvent(supabase!, id, 'invoice_synced', { invoice: fresh }, user?.email ?? null)
    return NextResponse.json({ invoice: fresh })
  } catch (e) { return errJson(e) }
}
