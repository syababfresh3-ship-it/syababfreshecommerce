// Modul Sebut Harga — helper server (DB, PDF, aset, pengesahan input, issue).
// Server sahaja (fs, react-pdf, admin client). Dipakai route /api/admin/quotations/*
// dan laluan awam /api/q/[token]/*. Lihat docs/plan-sebut-harga.md.
import { promises as fs } from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { renderToBuffer } from '@react-pdf/renderer'
import { buildQuotationElement, type QuotationPdfAssets } from '@/lib/quotation-pdf'
import { normalizePhone } from '@/lib/phone'
import { upsertCustomerAndGet } from '@/lib/customers'
import { SHOP_ORIGIN } from '@/lib/kurma-host'
import { BANKS } from '@/lib/seller'
import { RefrensError, createDocumentSmart, ensureClientForQuotation, isRefrensConfigured, quotationPartsFromQuotation, toInvoiceRef } from '@/lib/refrens'
import {
  addDays, calcTotals, quotationFromGiftOrder, sanitizeCharges, sanitizeClient, sanitizeCustomFields, sanitizeItems, sanitizeTerms,
  VALID_DAYS, type Quotation, type QuotationEvent, type QuotationItem, type QuotationCharge,
} from '@/lib/quotation'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SB = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }

export function rowToQuotation(r: Row): Quotation {
  return {
    id: r.id, quote_number: r.quote_number ?? null, status: r.status ?? 'draft',
    issued_at: r.issued_at ?? null, valid_until: r.valid_until ?? null, customer_id: r.customer_id ?? null,
    client: (r.client && typeof r.client === 'object') ? r.client : {},
    source_type: r.source_type ?? null, source_id: r.source_id ?? null,
    items: Array.isArray(r.items) ? r.items.map((i: Row) => ({ name: String(i.name ?? ''), description: i.description ?? null, qty: num(i.qty), unit: String(i.unit ?? 'pcs'), rate: num(i.rate) })) : [],
    subtotal: num(r.subtotal), discount: num(r.discount),
    charges: Array.isArray(r.charges) ? r.charges.map((c: Row) => ({ label: String(c.label ?? ''), amount: num(c.amount) })) : [],
    total: num(r.total), currency: r.currency ?? 'MYR',
    terms: Array.isArray(r.terms) ? r.terms.map(String) : [], notes: r.notes ?? null,
    show_bank: r.show_bank !== false, bank_key: r.bank_key ?? 'publicbank',
    custom_fields: Array.isArray(r.custom_fields) ? r.custom_fields : [],
    share_token: r.share_token ?? null, accepted_at: r.accepted_at ?? null, accepted_by: r.accepted_by ?? null,
    cancel_reason: r.cancel_reason ?? null, legacy_source: r.legacy_source ?? null,
    created_at: r.created_at, updated_at: r.updated_at,
  }
}

export async function loadQuotation(sb: SB, id: string): Promise<Quotation | null> {
  if (!UUID_RE.test(id)) return null
  const { data } = await sb.from('quotations').select('*').eq('id', id).maybeSingle()
  return data ? rowToQuotation(data) : null
}
export async function loadQuotationByToken(sb: SB, token: string): Promise<Quotation | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null
  const { data } = await sb.from('quotations').select('*').eq('share_token', token).maybeSingle()
  return data ? rowToQuotation(data) : null
}
export async function loadEvents(sb: SB, id: string): Promise<QuotationEvent[]> {
  const { data } = await sb.from('quotation_events').select('id, type, meta, actor, created_at').eq('quotation_id', id).order('created_at', { ascending: false }).limit(100)
  return (data ?? []) as QuotationEvent[]
}
export async function logQuotationEvent(sb: SB, quotationId: string, type: string, meta: Record<string, unknown> = {}, actor: string | null = null): Promise<void> {
  try { await sb.from('quotation_events').insert({ quotation_id: quotationId, type, meta, actor }) } catch { /* best-effort */ }
}

// ── Aset PDF (logo & cop) dari public/brand — segmen literal (NFT trace) ──────
const assetCache: QuotationPdfAssets = {}
async function readAsset(p: string): Promise<Buffer | null> { try { return await fs.readFile(p) } catch { return null } }
export async function loadPdfAssets(): Promise<QuotationPdfAssets> {
  if (!assetCache.logo)  assetCache.logo  = await readAsset(path.join(process.cwd(), 'public', 'brand', 'quotation-logo.png'))
  if (!assetCache.stamp) assetCache.stamp = await readAsset(path.join(process.cwd(), 'public', 'brand', 'stamp-syabab-trading.png'))
  return assetCache
}
export async function renderQuotationPdf(q: Quotation): Promise<Buffer> {
  const assets = await loadPdfAssets()
  return Buffer.from(await renderToBuffer(buildQuotationElement(q, assets)))
}
export function pdfResponse(pdf: Buffer, filename: string, inline = true): Response {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Response(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}

export const newShareToken = () => randomBytes(16).toString('hex')
export const publicShareUrl = (token: string) => `${SHOP_ORIGIN}/q/${token}`

// ── Pengesahan input admin (create/patch). `partial` = hanya kunci yang dihantar ──
export type QuotationInput = Partial<Pick<Quotation, 'client' | 'customer_id' | 'items' | 'discount' | 'charges' | 'terms' | 'notes' | 'show_bank' | 'bank_key' | 'custom_fields' | 'valid_until' | 'source_type' | 'source_id'>>
export function parseQuotationInput(body: Row, partial = false): { ok: true; data: QuotationInput } | { ok: false; error: string } {
  const d: QuotationInput = {}
  const has = (k: string) => !partial || body[k] !== undefined
  if (has('client')) d.client = sanitizeClient(body.client)
  if (has('customer_id')) d.customer_id = typeof body.customer_id === 'string' && UUID_RE.test(body.customer_id) ? body.customer_id : null
  if (has('items')) d.items = sanitizeItems(body.items)
  if (has('discount')) d.discount = Math.max(0, num(body.discount))
  if (has('charges')) d.charges = sanitizeCharges(body.charges)
  // terms/notes: hanya bila dihantar (tiada → lalai DEFAULT_TERMS/DEFAULT_NOTE dipakai oleh route cipta)
  if (body.terms !== undefined) d.terms = sanitizeTerms(body.terms)
  if (body.notes !== undefined) d.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null
  if (has('show_bank')) d.show_bank = body.show_bank !== false
  if (has('bank_key')) d.bank_key = typeof body.bank_key === 'string' && body.bank_key in BANKS ? body.bank_key : 'publicbank'
  if (has('custom_fields')) d.custom_fields = sanitizeCustomFields(body.custom_fields)
  if (has('valid_until')) d.valid_until = typeof body.valid_until === 'string' && DATE_RE.test(body.valid_until) ? body.valid_until : null
  if (has('source_type')) d.source_type = ['gift_order', 'borong', 'manual'].includes(body.source_type) ? body.source_type : null
  if (has('source_id')) d.source_id = typeof body.source_id === 'string' && UUID_RE.test(body.source_id) ? body.source_id : null

  if (!partial) {
    if (!d.client?.company && !d.client?.name) return { ok: false, error: 'Nama klien atau syarikat diperlukan' }
    if (!d.items?.length) return { ok: false, error: 'Sekurang-kurangnya satu baris item (nama, kuantiti > 0)' }
  } else {
    if (d.client && !d.client.company && !d.client.name) return { ok: false, error: 'Nama klien atau syarikat diperlukan' }
    if (d.items && !d.items.length) return { ok: false, error: 'Sekurang-kurangnya satu baris item (nama, kuantiti > 0)' }
  }
  return { ok: true, data: d }
}
export function totalsFor(items: QuotationItem[], discount: number, charges: QuotationCharge[]) {
  const t = calcTotals(items, discount, charges)
  return { subtotal: t.subtotal, discount: t.discount, total: t.total }
}

// ── Pelanggan: segerakkan snapshot klien ke customers (best-effort, isi medan kosong) ──
export async function syncCustomer(sb: SB, client: Quotation['client'], customerId: string | null): Promise<string | null> {
  let id = customerId
  if (!id) {
    const phone = normalizePhone(client.phone)
    if (!phone) return null
    const c = await upsertCustomerAndGet({ phone, source: 'manual', name: client.name ?? client.company ?? null, email: client.email ?? null, address: client.address ?? null })
    id = c?.id ?? null
  }
  if (!id) return null
  const extra: Row = {}
  if (client.company) extra.company = client.company
  if (client.reg_no) extra.company_reg_no = client.reg_no
  if (client.tin) extra.tin = client.tin
  if (client.address) extra.billing_address = client.address
  if (Object.keys(extra).length) {
    try { await sb.from('customers').update(extra).eq('id', id) } catch { /* lajur belum ada (migration 146) → abaikan */ }
  }
  return id
}

// ── Pra-isi dari gift order ────────────────────────────────────────────────
export async function giftOrderPrefill(sb: SB, orderId: string) {
  if (!UUID_RE.test(orderId)) return null
  const { data: o } = await sb.from('gift_orders')
    .select('id, order_number, name, phone, email, company, address, postcode, quantity, unit_price, delivery_fee, deposit_pct, config')
    .eq('id', orderId).maybeSingle()
  if (!o) return null
  const [b, f, d] = await Promise.all([
    sb.from('gift_boxes').select('id, name'), sb.from('gift_fillings').select('id, name'), sb.from('gift_designs').select('id, name'),
  ])
  return quotationFromGiftOrder(o, { boxes: b.data ?? [], fillings: f.data ?? [], designs: d.data ?? [] })
}

// ── Keluarkan (issue): nombor + token kongsi ──────────────────────────────
// Pilihan 1 pemilik (24 Okt 2026): bila Refrens dikonfigurasi, sebut harga DICIPTA DI REFRENS dulu
// (billType QUOTATION) dan nombor Refrens (siri lama STSB2026…) jadi nombor rasmi website.
// Refrens gagal → keluarkan GAGAL (tiada nombor tempatan senyap). Tanpa Refrens → siri tempatan
// `generate_quotation_number` (STSB-Q<tahun>-####). Cuba semula sekali jika nombor bertembung.
export async function issueQuotation(sb: SB, q: Quotation, actor: string | null): Promise<{ ok: true; q: Quotation } | { ok: false; error: string; status: number }> {
  if (q.status !== 'draft') return { ok: false, error: 'Sebut harga ini sudah dikeluarkan', status: 409 }
  if (!q.items.length) return { ok: false, error: 'Tiada baris item', status: 400 }
  if (!q.client.company && !q.client.name) return { ok: false, error: 'Nama klien diperlukan', status: 400 }
  const now = new Date()
  const validUntil = q.valid_until ?? addDays(now, VALID_DAYS)

  let refrensRef: ReturnType<typeof toInvoiceRef> | null = null
  if (isRefrensConfigured()) {
    try {
      await ensureClientForQuotation(q)
      const { invoice } = await createDocumentSmart(quotationPartsFromQuotation({ ...q, valid_until: validUntil }))
      refrensRef = toInvoiceRef(invoice)
      if (!refrensRef.number) return { ok: false, error: 'Refrens tidak memulangkan nombor sebut harga', status: 502 }
    } catch (e) {
      const msg = e instanceof RefrensError ? e.message : (e as Error).message
      return { ok: false, error: `Gagal cipta sebut harga di Refrens — tidak dikeluarkan. ${msg}`, status: 502 }
    }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    let number = refrensRef?.number ?? null
    if (!number) {
      const { data: n, error: nErr } = await sb.rpc('generate_quotation_number')
      if (nErr || !n) return { ok: false, error: nErr?.message ?? 'Gagal jana nombor (migration 146 belum dijalankan?)', status: 500 }
      number = n as string
    }
    const { data, error } = await sb.from('quotations').update({
      quote_number: number, status: 'issued', issued_at: now.toISOString(),
      valid_until: validUntil,
      share_token: q.share_token ?? newShareToken(), updated_at: now.toISOString(),
    }).eq('id', q.id).eq('status', 'draft').select('*').maybeSingle()
    if (error?.code === '23505' && !refrensRef) continue
    if (error) return { ok: false, error: refrensRef ? `Sebut harga ${number} dicipta di Refrens tetapi gagal disimpan di website: ${error.message}` : error.message, status: 500 }
    if (!data) return { ok: false, error: 'Sebut harga berubah, muat semula', status: 409 }
    const issued = rowToQuotation(data)
    await logQuotationEvent(sb, q.id, 'issued', { quote_number: number, source: refrensRef ? 'refrens' : 'local' }, actor)
    if (refrensRef) await logQuotationEvent(sb, q.id, 'refrens_quotation', { quotation: refrensRef }, actor)
    if (issued.source_type === 'gift_order' && issued.source_id) {
      // Order masih enquiry → tandakan quoted (additive; harga order tak disentuh sehingga "apply").
      try { await sb.from('gift_orders').update({ status: 'quoted', updated_at: now.toISOString() }).eq('id', issued.source_id).eq('status', 'enquiry') } catch { /* best-effort */ }
    }
    return { ok: true, q: issued }
  }
  return { ok: false, error: 'Nombor bertembung, cuba lagi', status: 409 }
}
