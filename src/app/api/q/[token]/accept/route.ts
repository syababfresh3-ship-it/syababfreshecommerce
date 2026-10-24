export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Awam: POST /api/q/<token>/accept { name, role?, website(honeypot) } → status accepted.
// Tiada wang bergerak; bayaran deposit kekal pautan CHIP dari gift order.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimitDb, clientIp } from '@/lib/rate-limit-db'
import { isHoneypotFilled } from '@/lib/order-guard'
import { sendAdminEmail } from '@/lib/zeptomail'
import { loadQuotationByToken, logQuotationEvent } from '@/lib/quotation-server'
import { clientDisplayName, isExpired } from '@/lib/quotation'

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = clientIp(request)
  if (!(await rateLimitDb(`q-accept:${ip}`, 10, 60_000))) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  if (isHoneypotFilled(body)) { console.warn('[q-accept] honeypot', ip); return NextResponse.json({ ok: true }) }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  const role = typeof body.role === 'string' ? body.role.trim().slice(0, 120) : ''
  if (name.length < 2) return NextResponse.json({ error: 'Please enter your name' }, { status: 400 })

  const sb = createAdminClient()
  const q = await loadQuotationByToken(sb, token)
  if (!q || q.status === 'draft') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (q.status === 'accepted') return NextResponse.json({ ok: true, already: true, accepted_at: q.accepted_at })
  if (q.status !== 'issued') return NextResponse.json({ error: 'This quotation is no longer open for acceptance' }, { status: 409 })
  if (isExpired(q)) return NextResponse.json({ error: 'This quotation has expired. Please contact us for an updated quotation.' }, { status: 409 })

  const acceptedBy = role ? `${name} (${role})` : name
  const now = new Date().toISOString()
  const { data, error } = await sb.from('quotations')
    .update({ status: 'accepted', accepted_at: now, accepted_by: acceptedBy, accepted_ip: ip, updated_at: now })
    .eq('id', q.id).eq('status', 'issued').select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Quotation changed, please reload' }, { status: 409 })
  await logQuotationEvent(sb, q.id, 'accepted', { by: acceptedBy, ip }, 'client')
  sendAdminEmail({
    subject: `Sebut harga ${q.quote_number} DITERIMA — ${clientDisplayName(q.client)}`,
    html: `<p>Sebut harga <b>${esc(q.quote_number ?? '')}</b> (${esc(clientDisplayName(q.client))}, RM${q.total.toFixed(2)}) diterima oleh <b>${esc(acceptedBy)}</b> pada ${esc(now)}.</p><p><a href="${esc(process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my')}/admin/quotations/${q.id}">Buka di admin</a></p>`,
  }).catch(() => {})
  return NextResponse.json({ ok: true, accepted_at: now })
}
