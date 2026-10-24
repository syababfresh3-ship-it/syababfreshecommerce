export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → PDF sebut harga (inline; ?download=1 → attachment). Draf pun boleh (ditanda DRAFT).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadQuotation, pdfResponse, renderQuotationPdf } from '@/lib/quotation-server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = await loadQuotation(supabase!, id)
  if (!q) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  const pdf = await renderQuotationPdf(q)
  const download = new URL(request.url).searchParams.get('download') === '1'
  return pdfResponse(pdf, q.quote_number ?? `DRAFT-${q.id.slice(0, 8)}`, !download)
}
