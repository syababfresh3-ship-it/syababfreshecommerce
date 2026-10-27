export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Hantar sebut harga / invois kepada klien.
//   GET  ?doc=quotation|invoice → pra-isi: teks lalai, telefon/email klien, perbualan WA Official (tetingkap 24j), template Meta, pautan wa.me
//   POST { doc, channel: official|template|unofficial|email, phone?, email?, message?, template?: {name, language}, saveDefault? }
// Event sebut harga: whatsapped / invoice_whatsapped / emailed / invoice_emailed (meta.channel). Lihat lib/doc-send.ts.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadEvents, loadQuotation, logQuotationEvent, publicShareUrl, renderQuotationPdf } from '@/lib/quotation-server'
import { invoiceRefFromEvents, type Quotation, type QuotationInvoiceRef } from '@/lib/quotation'
import { bankFor } from '@/lib/seller'
import {
  buildDocPayload, findWaConversation, listDocTemplates, sendDocOfficial, sendDocTemplate, waIdFrom, waMeUrl,
  type DocKind, type DocPayload, type DocTemplate, type SendChannel,
} from '@/lib/doc-send'
import { sendInvoiceEmail, sendQuotationEmail } from '@/lib/zeptomail'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any
type Ctx = { params: Promise<{ id: string }> }
const TPL_KEY = (kind: DocKind) => `wa_doc_tpl_${kind}`
const kindOf = (v: unknown): DocKind => (v === 'invoice' ? 'invoice' : 'quotation')

async function loadContext(sb: SB, id: string, kind: DocKind): Promise<{ q: Quotation; inv: QuotationInvoiceRef | null; p: DocPayload; depositPct: number | null; depositAmount: number | null } | { error: string; status: number }> {
  const q = await loadQuotation(sb, id)
  if (!q) return { error: 'Tidak dijumpai', status: 404 }
  if (q.status === 'cancelled') return { error: 'Sebut harga dibatalkan', status: 409 }
  const inv = invoiceRefFromEvents(await loadEvents(sb, id))
  let depositPct: number | null = null, amount: number | null = null
  try {   // deposit dari deal Pipeline (migration 147) — best-effort
    const { data } = await sb.from('gift_deals').select('deposit_pct, amount').eq('quotation_id', id).maybeSingle()
    if (data) { depositPct = Number(data.deposit_pct) || null; amount = Number(data.amount) || null }
  } catch { /* jadual tiada */ }
  const p = buildDocPayload(q, kind, inv, { depositPct, amount })
  if ('error' in p) return { error: p.error, status: 409 }
  const depositAmount = depositPct && (amount ?? p.total) ? Math.round((amount ?? p.total ?? 0) * depositPct) / 100 : null
  return { q, inv, p, depositPct, depositAmount }
}

async function loadDefaultTemplate(sb: SB, kind: DocKind): Promise<{ name: string; language: string } | null> {
  const { data } = await sb.from('app_settings').select('value').eq('key', TPL_KEY(kind)).maybeSingle()
  try { const v = data?.value ? JSON.parse(data.value) : null; return v?.name ? { name: String(v.name), language: String(v.language || 'ms') } : null } catch { return null }
}

async function fetchPdfBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!/pdf|octet-stream/i.test(ct)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > 8 * 1024 * 1024 ? null : buf.toString('base64')
  } catch { return null }
}

export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const kind = kindOf(new URL(request.url).searchParams.get('doc'))
  const ctx = await loadContext(supabase!, id, kind)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { p } = ctx
  const [conversation, tpls, defaultTemplate] = await Promise.all([
    p.waId ? findWaConversation(supabase!, p.waId) : Promise.resolve(null),
    listDocTemplates(),
    loadDefaultTemplate(supabase!, kind),
  ])
  return NextResponse.json({
    doc: kind, number: p.number, total: p.total, phone: p.phone, waId: p.waId, email: p.email, clientName: p.clientName,
    message: p.message, link: p.link, pdfUrl: p.pdfUrl, waMeUrl: p.waId ? waMeUrl(p.waId, p.message) : null,
    conversation, templates: tpls.templates.map(t => ({ name: t.name, language: t.language, headerType: t.shape.headerType, bodyParams: t.shape.bodyParams })),
    templatesError: tpls.error, defaultTemplate,
  })
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = (await request.json().catch(() => ({}))) as { doc?: string; channel?: SendChannel; phone?: string; email?: string; message?: string; template?: { name?: string; language?: string }; saveDefault?: boolean }
  const kind = kindOf(body.doc)
  const channel = body.channel
  if (!channel || !['official', 'template', 'unofficial', 'email'].includes(channel)) return NextResponse.json({ error: 'channel tidak sah' }, { status: 400 })
  const ctx = await loadContext(supabase!, id, kind)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { q, p: base, depositPct, depositAmount } = ctx
  const message = typeof body.message === 'string' && body.message.trim() ? body.message.trim().slice(0, 1500) : base.message
  const p: DocPayload = { ...base, message }
  const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : p.phone
  const waId = waIdFrom(phone)
  const actor = user?.email ?? null
  const eventType = kind === 'invoice' ? (channel === 'email' ? 'invoice_emailed' : 'invoice_whatsapped') : (channel === 'email' ? 'emailed' : 'whatsapped')

  if (channel === 'email') {
    const to = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : p.email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: 'Klien tiada email yang sah' }, { status: 400 })
    const toName = p.clientName || null
    const extra = body.message && body.message.trim() !== base.message ? body.message.trim().slice(0, 1500) : null   // hanya bila admin ubah teks
    let ok: boolean
    if (kind === 'quotation') {
      const pdf = await renderQuotationPdf(q)
      ok = await sendQuotationEmail({ to, toName, quoteNumber: p.number, total: q.total, validUntil: q.valid_until, shareUrl: publicShareUrl(q.share_token!), pdfBase64: pdf.toString('base64'), message: extra })
    } else {
      const pdfBase64 = p.pdfUrl ? await fetchPdfBase64(p.pdfUrl) : null
      const bank = bankFor(q.bank_key)
      ok = await sendInvoiceEmail({
        to, toName, invoiceNumber: p.number, total: p.total,
        depositLine: depositPct && depositAmount ? `Deposit ${depositPct}% (RM${depositAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) to start production; balance after delivery.` : null,
        bank: bank ? { name: bank.name, accName: bank.accName, accNo: bank.accNo } : null, pdfUrl: p.pdfUrl, link: p.link, pdfBase64, message: extra,
      })
    }
    if (!ok) return NextResponse.json({ error: 'Gagal hantar email' }, { status: 500 })
    await logQuotationEvent(supabase!, id, eventType, { channel, to, number: p.number }, actor)
    return NextResponse.json({ ok: true, to })
  }

  if (!waId) return NextResponse.json({ error: 'Telefon klien tidak sah — isi nombor telefon bimbit klien.' }, { status: 400 })

  if (channel === 'unofficial') {   // sales buka WhatsApp sendiri; sini rekod sahaja
    await logQuotationEvent(supabase!, id, eventType, { channel, to: waId, number: p.number }, actor)
    return NextResponse.json({ ok: true, to: waId, waMeUrl: waMeUrl(waId, p.message) })
  }

  const conv = await findWaConversation(supabase!, waId)
  if (channel === 'official') {
    if (!conv) return NextResponse.json({ error: 'Klien ini belum pernah WhatsApp nombor Official kita — guna template Meta atau Buka WhatsApp sendiri.', noConversation: true }, { status: 409 })
    const r = await sendDocOfficial(supabase!, conv, waId, p, user?.id ?? null)
    if (!r.ok) return NextResponse.json({ error: r.windowClosed ? 'Tetingkap 24 jam tutup (klien belum balas dalam 24 jam) — hantar dengan template Meta atau Buka WhatsApp sendiri.' : r.error, windowClosed: r.windowClosed }, { status: 502 })
    await logQuotationEvent(supabase!, id, eventType, { channel, to: waId, number: p.number, conversation_id: conv.conversationId }, actor)
    return NextResponse.json({ ok: true, to: waId, conversationId: conv.conversationId })
  }

  // template
  const chosen = body.template?.name ? { name: String(body.template.name), language: String(body.template.language || 'ms') } : await loadDefaultTemplate(supabase!, kind)
  if (!chosen) return NextResponse.json({ error: 'Pilih template Meta yang diluluskan dahulu.' }, { status: 400 })
  const { templates, error: tplErr } = await listDocTemplates()
  const tpl: DocTemplate | undefined = templates.find(t => t.name === chosen.name && t.language === chosen.language) ?? templates.find(t => t.name === chosen.name)
  if (!tpl) return NextResponse.json({ error: tplErr ?? `Template "${chosen.name}" tidak dijumpai / belum diluluskan di Meta.` }, { status: 400 })
  const r = await sendDocTemplate(supabase!, conv, waId, p, tpl, user?.id ?? null)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 })
  if (body.saveDefault) await supabase!.from('app_settings').upsert({ key: TPL_KEY(kind), value: JSON.stringify({ name: tpl.name, language: tpl.language }) }, { onConflict: 'key' })
  await logQuotationEvent(supabase!, id, eventType, { channel, to: waId, number: p.number, template: tpl.name, conversation_id: conv?.conversationId ?? null }, actor)
  return NextResponse.json({ ok: true, to: waId, template: tpl.name })
}
