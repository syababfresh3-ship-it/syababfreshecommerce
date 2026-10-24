export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Dokumen Refrens untuk page /admin/invoices.
// GET ?type=INVOICE|QUOTATION|ALL&status=UNPAID|PAID|ALL&q=&page=1&limit=25 (baca sahaja)
// POST { client, items, discount, charges, terms, due_days, send_email } (?dry=1 = payload sahaja) → cipta invois SEBENAR di Refrens
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { RefrensError, buildInvoicePayload, createInvoiceSmart, ensureClient, isRefrensConfigured, refrensAppUrl, searchDocuments, toInvoiceRef } from '@/lib/refrens'
import { calcTotals, sanitizeCharges, sanitizeClient, sanitizeItems, sanitizeTerms } from '@/lib/quotation'

export async function GET(request: Request) {
  const { forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  if (!isRefrensConfigured()) return NextResponse.json({ error: 'Refrens belum dikonfigurasi di pelayan ini (REFRENS_* env)', configured: false }, { status: 503 })
  const sp = new URL(request.url).searchParams
  const type = (sp.get('type') ?? 'INVOICE').toUpperCase()
  const status = (sp.get('status') ?? 'ALL').toUpperCase()
  const page = Math.max(1, Number(sp.get('page')) || 1)
  const limit = Math.min(50, Math.max(5, Number(sp.get('limit')) || 25))
  try {
    const r = await searchDocuments({ billType: type === 'ALL' ? null : type, status: status === 'ALL' ? null : status, q: sp.get('q'), limit, skip: (page - 1) * limit })
    return NextResponse.json({ total: r.total, page, limit, data: r.data.map(d => ({ ...d, url: refrensAppUrl(d) })) })
  } catch (e) {
    if (e instanceof RefrensError) return NextResponse.json({ error: e.message }, { status: e.status >= 500 ? 502 : 400 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  if (!isRefrensConfigured()) return NextResponse.json({ error: 'Refrens belum dikonfigurasi di pelayan ini (REFRENS_* env)' }, { status: 503 })
  const b = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })
  const client = sanitizeClient(b.client)
  if (!client.company && !client.name) return NextResponse.json({ error: 'Nama klien atau syarikat diperlukan' }, { status: 400 })
  const items = sanitizeItems(b.items)
  if (!items.length) return NextResponse.json({ error: 'Sekurang-kurangnya satu baris item' }, { status: 400 })
  const charges = sanitizeCharges(b.charges)
  const totals = calcTotals(items, Number(b.discount) || 0, charges)
  const terms = sanitizeTerms(b.terms)
  const dueDays = Math.min(Math.max(Math.round(Number(b.due_days) || 14), 0), 180)
  const sendEmail = b.send_email === true && !!client.email
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null
  const parts = {
    client, items, discount: totals.discount, charges, terms, dueDays, sendEmail,
    invoiceNumber: str(b.invoice_number, 50), invoiceDate: str(b.invoice_date, 10), dueDate: str(b.due_date, 10),
    title: str(b.title, 100) ?? undefined, subtitle: str(b.subtitle, 200), notes: str(b.notes, 2000),
  }
  if (new URL(request.url).searchParams.get('dry') === '1') return NextResponse.json({ dry: true, payload: buildInvoicePayload(parts, true), payload_safe: buildInvoicePayload(parts, false), total: totals.total })
  try {
    const clientRef = typeof b.customer_id === 'string' && b.customer_id ? `web-${b.customer_id}` : `web-manual-${Date.now()}`
    const { client: rc, created } = await ensureClient(client, clientRef)
    const { invoice: inv, rich } = await createInvoiceSmart(parts)
    const ref = toInvoiceRef(inv)
    console.info('[refrens] invois dicipta dari admin', { number: ref.number, by: user?.email ?? null, client_created: created, client_id: rc?._id ?? null, rich })
    return NextResponse.json({ ok: true, invoice: ref, url: refrensAppUrl({ id: ref.id, billType: 'INVOICE' }), emailed: sendEmail, rich }, { status: 201 })
  } catch (e) {
    if (e instanceof RefrensError) return NextResponse.json({ error: e.message, refrens: e.body }, { status: e.status >= 500 ? 502 : 400 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
