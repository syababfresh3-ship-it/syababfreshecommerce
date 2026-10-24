export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → salinan sebagai draf baharu (tiada nombor/token; nombor baharu bila dikeluarkan).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadQuotation, logQuotationEvent, rowToQuotation } from '@/lib/quotation-server'
import { addDays, VALID_DAYS } from '@/lib/quotation'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = await loadQuotation(supabase!, id)
  if (!q) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  const row = {
    status: 'draft', client: q.client, customer_id: q.customer_id, source_type: q.source_type, source_id: q.source_id,
    items: q.items, subtotal: q.subtotal, discount: q.discount, charges: q.charges, total: q.total, currency: q.currency,
    terms: q.terms, notes: q.notes, show_bank: q.show_bank, bank_key: q.bank_key, custom_fields: q.custom_fields,
    valid_until: addDays(new Date(), VALID_DAYS), created_by: user?.id ?? null,
  }
  const { data, error } = await supabase!.from('quotations').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const copy = rowToQuotation(data)
  const actor = user?.email ?? null
  await logQuotationEvent(supabase!, copy.id, 'created', { duplicated_from: q.quote_number ?? q.id }, actor)
  await logQuotationEvent(supabase!, q.id, 'duplicated', { to: copy.id }, actor)
  return NextResponse.json(copy, { status: 201 })
}
