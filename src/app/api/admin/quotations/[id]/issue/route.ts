export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → keluarkan draf: nombor STSB-Q<tahun>-<####>, status issued, sah hingga, token kongsi.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextRequest } from 'next/server'
import { issueQuotation, loadQuotation, publicShareUrl } from '@/lib/quotation-server'
import { buildInvoicePayload, isRefrensConfigured, quotationPartsFromQuotation } from '@/lib/refrens'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = await loadQuotation(supabase!, id)
  if (!q) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  // ?dry=1 → payload sebut harga Refrens yang akan dihantar (tiada tulisan)
  if (req.nextUrl.searchParams.get('dry') === '1') return NextResponse.json({ dry: true, refrens: isRefrensConfigured(), payload: buildInvoicePayload(quotationPartsFromQuotation(q), true) })
  const res = await issueQuotation(supabase!, q, user?.email ?? null)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ ...res.q, share_url: res.q.share_token ? publicShareUrl(res.q.share_token) : null })
}
