export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Awam: GET /api/q/<token>/pdf → PDF sebut harga (token 32 hex dari pautan kongsi).
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { loadQuotationByToken, pdfResponse, renderQuotationPdf } from '@/lib/quotation-server'

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!(await rateLimitDb(`q-pdf:${clientIp(request)}`, 30, 60_000))) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const q = await loadQuotationByToken(createAdminClient(), token)
  if (!q || q.status === 'draft') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const pdf = await renderQuotationPdf(q)
  return pdfResponse(pdf, q.quote_number ?? 'quotation', true)
}
