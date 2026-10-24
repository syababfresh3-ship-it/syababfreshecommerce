export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST { message?, to? } → email PDF + pautan /q/<token> ke klien. Mesti sudah dikeluarkan.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadQuotation, logQuotationEvent, publicShareUrl, renderQuotationPdf } from '@/lib/quotation-server'
import { sendQuotationEmail } from '@/lib/zeptomail'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = await loadQuotation(supabase!, id)
  if (!q) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  if (!q.quote_number || !q.share_token) return NextResponse.json({ error: 'Keluarkan sebut harga dahulu sebelum email' }, { status: 409 })
  if (q.status === 'cancelled') return NextResponse.json({ error: 'Sebut harga dibatalkan' }, { status: 409 })

  const body = await request.json().catch(() => ({})) as { message?: string; to?: string }
  const to = (typeof body.to === 'string' && body.to.trim()) || q.client.email || ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: 'Klien tiada email yang sah' }, { status: 400 })
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1500) : null

  const pdf = await renderQuotationPdf(q)
  const ok = await sendQuotationEmail({
    to, toName: q.client.attn || q.client.name || q.client.company || null,
    quoteNumber: q.quote_number, total: q.total, validUntil: q.valid_until,
    shareUrl: publicShareUrl(q.share_token), pdfBase64: pdf.toString('base64'), message,
  })
  if (!ok) return NextResponse.json({ error: 'Gagal hantar email' }, { status: 500 })
  await logQuotationEvent(supabase!, id, 'emailed', { to }, user?.email ?? null)
  return NextResponse.json({ ok: true, to })
}
