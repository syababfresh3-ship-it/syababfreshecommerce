export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Modul Sebut Harga — senarai + cipta. GET ?status=&q=&source_id=&from=&to= ;
// POST { client, items, ..., issue?: boolean } → draf (atau terus dikeluarkan).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { issueQuotation, logQuotationEvent, parseQuotationInput, rowToQuotation, syncCustomer, totalsFor } from '@/lib/quotation-server'
import { DEFAULT_TERMS, DEFAULT_NOTE, isExpired, QUOTATION_STATUSES, type QuotationInvoiceRef } from '@/lib/quotation'

const STATUS_IDS = QUOTATION_STATUSES.map(s => s.id as string)

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sp = new URL(request.url).searchParams
  const status = sp.get('status') ?? 'all'
  const q = (sp.get('q') ?? '').replace(/[,()*\\%]/g, ' ').trim()
  const sourceId = sp.get('source_id')
  const from = sp.get('from'), to = sp.get('to')

  let query = supabase!.from('quotations').select('*').order('created_at', { ascending: false }).limit(500)
  if (status !== 'all' && STATUS_IDS.includes(status)) query = query.eq('status', status)
  if (sourceId) query = query.eq('source_id', sourceId)
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte('created_at', from + 'T00:00:00')
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte('created_at', to + 'T23:59:59')
  if (q.length >= 2) query = query.or(`quote_number.ilike.%${q}%,client->>company.ilike.%${q}%,client->>name.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const base = (data ?? []).map(rowToQuotation)
  // Rujukan invois Refrens (fasa 2) — event 'converted'/'invoice_synced' terbaharu per sebut harga.
  const convertedIds = base.filter(r => r.status === 'converted').map(r => r.id)
  const invoices = new Map<string, QuotationInvoiceRef>()
  if (convertedIds.length) {
    const { data: evs } = await supabase!.from('quotation_events').select('quotation_id, type, meta, created_at')
      .in('quotation_id', convertedIds).in('type', ['converted', 'invoice_synced']).order('created_at', { ascending: false })
    for (const ev of evs ?? []) {
      const inv = (ev.meta as { invoice?: QuotationInvoiceRef } | null)?.invoice
      if (inv && !invoices.has(ev.quotation_id)) invoices.set(ev.quotation_id, inv)
    }
  }
  const rows = base.map(r => ({ ...r, expired: isExpired(r), invoice: invoices.get(r.id) ?? null }))
  const summary = {
    count: rows.length,
    draft: rows.filter(r => r.status === 'draft').length,
    issued: rows.filter(r => r.status === 'issued').length,
    accepted: rows.filter(r => r.status === 'accepted').length,
    total_issued: rows.filter(r => ['issued', 'accepted', 'converted'].includes(r.status)).reduce((s, r) => s + r.total, 0),
    total_accepted: rows.filter(r => ['accepted', 'converted'].includes(r.status)).reduce((s, r) => s + r.total, 0),
  }
  return NextResponse.json({ quotations: rows, summary })
}

export async function POST(request: Request) {
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })

  const parsed = parseQuotationInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const d = parsed.data
  const totals = totalsFor(d.items ?? [], d.discount ?? 0, d.charges ?? [])
  const customerId = await syncCustomer(supabase!, d.client ?? {}, d.customer_id ?? null)

  const row = {
    status: 'draft', client: d.client ?? {}, customer_id: customerId,
    items: d.items ?? [], discount: totals.discount, charges: d.charges ?? [], subtotal: totals.subtotal, total: totals.total,
    terms: d.terms ?? DEFAULT_TERMS, notes: d.notes === undefined ? DEFAULT_NOTE : d.notes,
    show_bank: d.show_bank ?? true, bank_key: d.bank_key ?? 'publicbank', custom_fields: d.custom_fields ?? [],
    valid_until: d.valid_until ?? null, needed_by: d.needed_by ?? null, source_type: d.source_type ?? null, source_id: d.source_id ?? null,
    created_by: user?.id ?? null,
  }
  const { data, error } = await supabase!.from('quotations').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let q = rowToQuotation(data)
  const actor = user?.email ?? null
  await logQuotationEvent(supabase!, q.id, 'created', { source_type: q.source_type, source_id: q.source_id }, actor)

  if (body.issue === true) {
    const res = await issueQuotation(supabase!, q, actor)
    if (!res.ok) return NextResponse.json({ error: res.error, id: q.id }, { status: res.status })
    q = res.q
  }
  return NextResponse.json(q, { status: 201 })
}
