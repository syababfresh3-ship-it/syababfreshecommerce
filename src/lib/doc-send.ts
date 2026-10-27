// ============================================================
// lib/doc-send — hantar sebut harga / invois kepada klien melalui:
//   official   = nombor WhatsApp Official (Cloud API) ke perbualan inbox sedia ada — PDF sebagai dokumen + kapsyen
//   template   = template Meta diluluskan (bila tetingkap 24 jam tutup atau klien belum pernah WhatsApp nombor Official)
//   unofficial = pautan wa.me — buka WhatsApp akaun sales sendiri dengan teks pra-isi (klien lama PM akaun lama)
//   email      = ZeptoMail (sendQuotationEmail / sendInvoiceEmail dalam zeptomail.ts)
// Team sales pilih saluran setiap kali hantar. Guna semula corak /api/whatsapp/send (log wa_messages + wa_conversations). Additive.
// ============================================================
import { formatWaPhone, listTemplates, sendMedia, sendTemplate, sendText, type WaTemplate } from '@/lib/whatsapp-cloud'
import { getSender } from '@/lib/wa-numbers'
import { publicShareUrl } from '@/lib/quotation-server'
import { bankFor } from '@/lib/seller'
import { SHOP_ORIGIN } from '@/lib/kurma-host'
import { rm, type Quotation, type QuotationInvoiceRef } from '@/lib/quotation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

export type DocKind = 'quotation' | 'invoice'
export type SendChannel = 'official' | 'template' | 'unofficial' | 'email'

export interface DocPayload {
  kind: DocKind
  number: string
  total: number | null
  pdfUrl: string | null   // URL awam — Meta/klien muat turun: sebut harga /api/q/<token>/pdf, invois PDF Refrens
  link: string | null     // pautan lihat: sebut harga /q/<token>, invois pautan Refrens
  filename: string
  message: string         // teks lalai (kapsyen WA / wa.me / badan) — admin boleh edit
  clientName: string
  phone: string
  waId: string | null     // E.164 tanpa '+' (null kalau telefon klien tak sah)
  email: string
}

export const waIdFrom = (phone: string | null | undefined): string | null => {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15 ? formatWaPhone(digits) : null
}
export const waMeUrl = (waId: string, text: string) => `https://wa.me/${waId}?text=${encodeURIComponent(text)}`
const fmtDate = (v: string | null | undefined) => v ? new Date(v.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null

/** Bina muatan dokumen + teks lalai. Deposit dari deal (pilihan) untuk invois. */
export function buildDocPayload(
  q: Quotation, kind: DocKind, inv: QuotationInvoiceRef | null,
  opts: { depositPct?: number | null; amount?: number | null } = {},
): DocPayload | { error: string } {
  const clientName = (q.client.attn || q.client.name || q.client.company || '').trim()
  const salam = clientName ? `Salam ${clientName},` : 'Salam,'
  const phone = (q.client.phone ?? '').trim()
  const base = { clientName, phone, waId: waIdFrom(phone), email: (q.client.email ?? '').trim() }

  if (kind === 'quotation') {
    if (!q.quote_number || !q.share_token) return { error: 'Keluarkan sebut harga dahulu sebelum hantar' }
    const link = publicShareUrl(q.share_token)
    const valid = fmtDate(q.valid_until)
    const message = `${salam}\n\nSebut harga *${q.quote_number}* dari Syabab Trading Sdn Bhd — jumlah *${rm(q.total)}*${valid ? `, sah hingga ${valid}` : ''}.\nLihat, muat turun PDF & sahkan di sini:\n${link}\n\nAda soalan, balas sahaja mesej ini. Terima kasih.`
    return { ...base, kind, number: q.quote_number, total: q.total, pdfUrl: `${SHOP_ORIGIN}/api/q/${q.share_token}/pdf`, link, filename: `${q.quote_number}.pdf`, message }
  }

  if (!inv) return { error: 'Belum ada invois — tekan Convert to Invoice dahulu' }
  const total = inv.total ?? q.total
  const pct = Number(opts.depositPct) || 0
  const amount = Number(opts.amount) || Number(total) || 0
  const deposit = pct > 0 && amount > 0 ? Math.round(amount * pct) / 100 : 0
  const bank = bankFor(q.bank_key)
  const link = inv.link ?? inv.pdf ?? null
  const lines = [
    salam, '',
    `Invois *${inv.number}* dari Syabab Trading Sdn Bhd — jumlah *${rm(total)}*.`,
    deposit > 0 ? `Deposit ${pct}%: *${rm(deposit)}* untuk mula produksi; baki selepas penghantaran.` : null,
    bank ? `Bayaran ke ${bank.name} ${bank.accNo} (${bank.accName}). Kongsi slip bila selesai ya.` : null,
    inv.pdf ? `PDF invois: ${inv.pdf}` : link ? `Lihat invois: ${link}` : null,
    '', 'Terima kasih.',
  ].filter((l): l is string => l !== null)
  return { ...base, kind, number: inv.number, total, pdfUrl: inv.pdf ?? null, link, filename: `${inv.number}.pdf`, message: lines.join('\n') }
}

// ── Perbualan inbox (nombor Official) ──────────────────────────────────────
export interface WaConvInfo {
  conversationId: string; contactId: string; phoneNumberId: string | null; numberName: string | null
  assignedTo: string | null; lastInboundAt: string | null; windowOpen: boolean   // tetingkap 24 jam Meta
}
export async function findWaConversation(sb: SB, waId: string): Promise<WaConvInfo | null> {
  const { data: c } = await sb.from('wa_contacts').select('id, last_inbound_at').eq('wa_id', waId).maybeSingle()
  if (!c) return null
  const { data: conv } = await sb.from('wa_conversations').select('id, phone_number_id, assigned_to')
    .eq('contact_id', c.id).order('last_message_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
  if (!conv) return null
  let numberName: string | null = null
  if (conv.phone_number_id) {
    const { data: n } = await sb.from('wa_numbers').select('display_name').eq('phone_number_id', conv.phone_number_id).maybeSingle()
    numberName = (n?.display_name as string | undefined) ?? null
  }
  const last = c.last_inbound_at ? new Date(c.last_inbound_at as string).getTime() : 0
  return {
    conversationId: conv.id, contactId: c.id, phoneNumberId: conv.phone_number_id ?? null, numberName,
    assignedTo: conv.assigned_to ?? null, lastInboundAt: (c.last_inbound_at as string | null) ?? null,
    windowOpen: last > 0 && Date.now() - last < 24 * 3600 * 1000,
  }
}

// Ralat Meta bila tetingkap 24 jam tutup (131047 re-engagement) / tak boleh dihantar (131026).
export const isWindowClosedError = (err: string | undefined) => /131047|131026|re-?engagement|24[- ]hour|outside the allowed window/i.test(err ?? '')

async function logOutbound(sb: SB, conv: WaConvInfo, m: { waMessageId: string | undefined; type: string; body: string | null; mediaUrl: string | null; templateName: string | null; preview: string; userId: string | null }) {
  const now = new Date().toISOString()
  await sb.from('wa_messages').insert({
    conversation_id: conv.conversationId, contact_id: conv.contactId, wa_message_id: m.waMessageId ?? null, direction: 'out', type: m.type,
    body: m.body, media_url: m.mediaUrl, template_name: m.templateName, status: 'sent', sent_by: m.userId, created_at: now,
  })
  await sb.from('wa_conversations').update({
    last_message_at: now, last_message_preview: m.preview.slice(0, 200), unread_count: 0, needs_reply: false,
    ...(conv.assignedTo || !m.userId ? {} : { assigned_to: m.userId }),
  }).eq('id', conv.conversationId)
}

/** Hantar dari nombor Official ke perbualan sedia ada: PDF (dokumen + kapsyen) atau teks sahaja kalau tiada PDF. */
export async function sendDocOfficial(sb: SB, conv: WaConvInfo, waId: string, p: DocPayload, userId: string | null): Promise<{ ok: true; id?: string } | { ok: false; error: string; windowClosed: boolean }> {
  const sender = await getSender(sb, conv.phoneNumberId)
  const caption = p.message.slice(0, 1024)   // had kapsyen Meta
  const r = p.pdfUrl ? await sendMedia(waId, p.pdfUrl, caption, 'document', sender, p.filename) : await sendText(waId, p.message, sender)
  if (!r.ok) return { ok: false, error: r.error || 'Hantar gagal', windowClosed: isWindowClosedError(r.error) }
  await logOutbound(sb, conv, { waMessageId: r.id, type: p.pdfUrl ? 'document' : 'text', body: p.pdfUrl ? caption : p.message, mediaUrl: p.pdfUrl, templateName: null, preview: caption, userId })
  return { ok: true, id: r.id }
}

// ── Template Meta (tetingkap tutup / tiada perbualan) ───────────────────────
export interface TplShape { headerType: 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'TEXT' | 'LOCATION' | 'NONE'; bodyParams: number; bodyText: string }
export function templateShape(t: WaTemplate): TplShape {
  const comps = (t.components ?? []) as { type?: string; format?: string; text?: string }[]
  const header = comps.find(c => c.type === 'HEADER'); const body = comps.find(c => c.type === 'BODY')
  const bodyText = body?.text ?? ''
  const n = new Set((bodyText.match(/\{\{\s*\d+\s*\}\}/g) ?? []).map(m => m.replace(/\D/g, ''))).size
  return { headerType: ((header?.format as TplShape['headerType'] | undefined) ?? 'NONE'), bodyParams: n, bodyText }
}
export type DocTemplate = { name: string; language: string; shape: TplShape }
export async function listDocTemplates(): Promise<{ templates: DocTemplate[]; error: string | null }> {
  const r = await listTemplates(true)
  return { templates: r.templates.map(t => ({ name: t.name, language: t.language, shape: templateShape(t) })), error: r.ok ? null : (r.error ?? 'Gagal senarai template') }
}

/** Hantar template: parameter badan berturutan {{1}} nama, {{2}} nombor dokumen, {{3}} jumlah, {{4}} pautan; header DOCUMENT = PDF. */
export async function sendDocTemplate(sb: SB, conv: WaConvInfo | null, waId: string, p: DocPayload, tpl: DocTemplate, userId: string | null): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  if (tpl.shape.headerType === 'DOCUMENT' && !p.pdfUrl) return { ok: false, error: 'Template ini perlu PDF tetapi dokumen tiada PDF awam.' }
  if (tpl.shape.headerType === 'IMAGE' || tpl.shape.headerType === 'VIDEO' || tpl.shape.headerType === 'LOCATION') return { ok: false, error: `Template dengan header ${tpl.shape.headerType} tak sesuai untuk dokumen.` }
  const values = [p.clientName || 'Tuan/Puan', p.number, p.total !== null ? rm(p.total) : '-', p.link ?? p.pdfUrl ?? SHOP_ORIGIN]
  const bodyParams: Record<string, string> = {}
  for (let i = 0; i < tpl.shape.bodyParams; i++) bodyParams[String(i + 1)] = values[i] ?? ''
  const header = tpl.shape.headerType === 'DOCUMENT' && p.pdfUrl ? { type: 'document' as const, link: p.pdfUrl } : undefined
  const sender = await getSender(sb, conv?.phoneNumberId ?? null)
  const r = await sendTemplate(waId, tpl.name, tpl.language, bodyParams, header, sender)
  if (!r.ok) return { ok: false, error: r.error || 'Hantar template gagal' }
  if (conv) await logOutbound(sb, conv, { waMessageId: r.id, type: 'template', body: null, mediaUrl: p.pdfUrl, templateName: tpl.name, preview: `[template] ${tpl.name} · ${p.number}`, userId })
  return { ok: true, id: r.id }
}
