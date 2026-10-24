// Refrens REST API (akaun pemilik 'syabab-dates') — invois & klien dari modul Sebut Harga.
// Server sahaja. Env: REFRENS_URL_KEY, REFRENS_APP_ID, REFRENS_APP_SECRET (.env.local + Vercel).
// Dokumen: https://www.refrens.com/api/docs/ (base https://api.refrens.com). Tiada webhook →
// status bayaran ditarik dengan GET. Tiada sandbox → createInvoice tulis ke akaun SEBENAR.
import type { Quotation, QuotationCharge, QuotationClient, QuotationItem } from '@/lib/quotation'
import { SELLER } from '@/lib/seller'

const BASE = 'https://api.refrens.com'
const COUNTRY = 'MY'
const INVOICE_DUE_DAYS = 14

export function refrensConfig() {
  const urlKey = process.env.REFRENS_URL_KEY?.trim(), appId = process.env.REFRENS_APP_ID?.trim(), appSecret = process.env.REFRENS_APP_SECRET?.trim()
  return urlKey && appId && appSecret ? { urlKey, appId, appSecret } : null
}
export const isRefrensConfigured = () => !!refrensConfig()

export class RefrensError extends Error {
  constructor(message: string, public status: number, public body: unknown = null) { super(message) }
}

// ── Token (app-secret) — cache dalam modul, hayat JWT dibaca dari `exp` (fallback 50 min) ──
let cached: { token: string; exp: number } | null = null
function jwtExp(token: string): number {
  try { const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); return typeof p.exp === 'number' ? p.exp * 1000 : 0 } catch { return 0 }
}
async function getToken(force = false): Promise<string> {
  const cfg = refrensConfig()
  if (!cfg) throw new RefrensError('Refrens belum dikonfigurasi (REFRENS_URL_KEY / APP_ID / APP_SECRET)', 503)
  if (!force && cached && cached.exp > Date.now() + 60_000) return cached.token
  const res = await fetch(`${BASE}/authentication`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy: 'app-secret', appId: cfg.appId, appSecret: cfg.appSecret }), cache: 'no-store' })
  const j = await res.json().catch(() => ({})) as { accessToken?: string; message?: string }
  if (!res.ok || !j.accessToken) throw new RefrensError(`Refrens login gagal (${res.status}): ${j.message ?? 'tiada token'}`, res.status, j)
  const exp = jwtExp(j.accessToken)
  cached = { token: j.accessToken, exp: exp || Date.now() + 50 * 60_000 }
  return cached.token
}

async function call<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) }, cache: 'no-store' })
  if (res.status === 401 && retry) { await getToken(true); return call<T>(path, init, false) }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new RefrensError(`Refrens ${init.method ?? 'GET'} ${path} → ${res.status}: ${(body as { message?: string })?.message ?? 'ralat'}`, res.status, body)
  return body as T
}

// ── Jenis balasan (subset yang kita guna) ───────────────────────────────────
export interface RefrensInvoice {
  _id: string; invoiceNumber: string; status: string; currency?: string; invoiceDate?: string; dueDate?: string
  finalTotal?: { total?: number; amount?: number; subTotal?: number; discount?: number }
  share?: { link?: string; pdf?: string }
  client?: string; createdAt?: string; updatedAt?: string
}
export interface RefrensClient { _id?: string; clientId?: string | null; name: string; email?: string; phone?: string }

// Rujukan yang disimpan dalam quotation_events (meta) — tiada lajur baharu.
export interface QuotationInvoiceRef {
  id: string; number: string; status: string; total: number | null
  pdf: string | null; link: string | null; created_at: string; synced_at: string
}
export function toInvoiceRef(inv: RefrensInvoice, createdAt?: string): QuotationInvoiceRef {
  const now = new Date().toISOString()
  return { id: inv._id, number: inv.invoiceNumber, status: inv.status, total: inv.finalTotal?.total ?? null, pdf: inv.share?.pdf ?? null, link: inv.share?.link ?? null, created_at: createdAt ?? inv.createdAt ?? now, synced_at: now }
}

// ── Klien ───────────────────────────────────────────────────────────────────
const normPhone = (p: string | null | undefined) => {
  const d = (p ?? '').replace(/[^\d]/g, '')
  if (!d) return null
  return d.startsWith('60') ? `+${d}` : d.startsWith('0') ? `+6${d}` : `+${d}`
}
const paths = { clients: (k: string) => `/api/v1/businesses/${k}/clients`, invoices: (k: string) => `/businesses/${k}/invoices` }

export async function findClient(q: { email?: string | null; phone?: string | null; name?: string | null }): Promise<RefrensClient | null> {
  const { urlKey } = refrensConfig()!
  const tries: string[] = []
  if (q.email) tries.push(`email=${encodeURIComponent(q.email.trim().toLowerCase())}`)
  const ph = normPhone(q.phone); if (ph) tries.push(`phone=${encodeURIComponent(ph)}`)
  for (const t of tries) {
    const r = await call<{ data?: RefrensClient[] } | RefrensClient[]>(`${paths.clients(urlKey)}?${t}&$limit=1`)
    const list = Array.isArray(r) ? r : (r.data ?? [])
    if (list[0]) return list[0]
  }
  return null
}

export async function createClient(c: { clientId: string; name: string; email?: string | null; phone?: string | null; street?: string | null; pincode?: string | null; tin?: string | null; regNo?: string | null; isCompany?: boolean }): Promise<RefrensClient> {
  const { urlKey } = refrensConfig()!
  const body: Record<string, unknown> = { clientId: c.clientId.slice(0, 128), name: c.name.slice(0, 500), country: COUNTRY, isClient: true }
  if (c.email) body.email = c.email.trim().toLowerCase()
  const ph = normPhone(c.phone); if (ph) body.phone = ph
  if (c.street) body.street = c.street.slice(0, 2500)
  if (c.pincode) body.pincode = c.pincode.slice(0, 20)
  if (c.isCompany !== undefined) body.clientType = c.isCompany ? 'COMPANY' : 'INDIVIDUAL'
  const tin = (c.tin ?? '').replace(/\s+/g, '').toUpperCase(); if (/^[A-Z0-9]{10,15}$/.test(tin)) body.tinNumber = tin
  if (c.regNo) body.additionalIds = [{ label: 'BRN', value: c.regNo.trim(), showInInvoice: true }]
  try { return await call<RefrensClient>(paths.clients(urlKey), { method: 'POST', body: JSON.stringify(body) }) }
  catch (e) {
    // Medan pilihan ditolak (INVALID_FIELD) → cuba semula tanpa TIN/BRN/clientType.
    if (e instanceof RefrensError && e.status === 400) {
      delete body.tinNumber; delete body.additionalIds; delete body.clientType
      return call<RefrensClient>(paths.clients(urlKey), { method: 'POST', body: JSON.stringify(body) })
    }
    throw e
  }
}

// ── Invois ───────────────────────────────────────────────────────────────────
const r2 = (n: number) => Math.round(n * 100) / 100
export interface InvoiceParts {
  client: QuotationClient; items: QuotationItem[]; discount: number; charges: QuotationCharge[]; terms: string[]
  dueDays?: number; refNumber?: string | null; title?: string; sendEmail?: boolean
  // Medan borang gaya Refrens (pilihan): nombor sendiri (kosong = auto), tarikh, tarikh akhir, subtajuk, nota.
  invoiceNumber?: string | null; invoiceDate?: string | null; dueDate?: string | null; subtitle?: string | null; notes?: string | null
  billType?: 'INVOICE' | 'QUOTATION'   // QUOTATION = sebut harga di Refrens (sokongan Refrens 24 Okt: endpoint sama, billType)
}
const toIso = (d: string | null | undefined, fallback: Date) => d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00Z').toISOString() : fallback.toISOString()
/** Payload POST /invoices Refrens dari bahagian umum (sebut harga website ATAU borang invois terus).
 *  `rich` = hantar description/unit/notes sebagai medan berasingan (tidak didokumen — cuba dulu,
 *  route jatuh balik ke versi selamat jika Refrens tolak 400). */
export function buildInvoicePayload(p: InvoiceParts, rich = false) {
  const c = p.client
  const name = (c.company || c.name || 'Customer').trim()
  const items = p.items.map(it => rich
    ? { name: it.name.slice(0, 1000), ...(it.description ? { description: it.description.slice(0, 1000) } : {}), ...(it.unit && it.unit !== 'pcs' ? { unit: it.unit.slice(0, 20) } : {}), rate: r2(it.rate), quantity: it.qty }
    : { name: it.description ? `${it.name} — ${it.description}`.slice(0, 1000) : it.name.slice(0, 1000), rate: r2(it.rate), quantity: it.qty })
  const additionalCharges: { label: string; amount: number; type: 'FIXED_AMOUNT'; multiplier: 1 | -1 }[] = []
  if (p.discount > 0) additionalCharges.push({ label: 'Discount', amount: r2(p.discount), type: 'FIXED_AMOUNT', multiplier: -1 })
  for (const ch of p.charges) if (ch.amount > 0) additionalCharges.push({ label: ch.label, amount: r2(ch.amount), type: 'FIXED_AMOUNT', multiplier: 1 })
  const now = new Date()
  const dueDefault = new Date(now); dueDefault.setDate(dueDefault.getDate() + (p.dueDays ?? INVOICE_DUE_DAYS))
  const phone = c.phone ? (normPhone(c.phone) ?? c.phone) : null
  const subtitle = p.subtitle?.trim() || (p.refNumber ? `Ref: Quotation ${p.refNumber}` : '')
  const isQuote = p.billType === 'QUOTATION'
  const payload: Record<string, unknown> = {
    invoiceTitle: (p.title?.trim() || (isQuote ? 'Quotation' : 'Invoice')).slice(0, 100),
    ...(subtitle ? { invoiceSubTitle: subtitle.slice(0, 200) } : {}),
    ...(p.invoiceNumber?.trim() ? { invoiceNumber: p.invoiceNumber.trim().slice(0, 50) } : {}),
    ...(isQuote ? { billType: 'QUOTATION' } : { invoiceType: 'INVOICE' }),
    currency: 'MYR',
    invoiceDate: toIso(p.invoiceDate, now),
    dueDate: toIso(p.dueDate, dueDefault),
    billedTo: {
      name, country: COUNTRY,
      ...(c.address ? { street: c.address.slice(0, 2500) } : {}),
      ...(phone ? { phone, phoneShowInInvoice: true } : {}),
      ...(c.email ? { email: c.email, emailShowInInvoice: true } : {}),
    },
    contact: { ...(phone ? { phone } : {}), ...(c.email ? { email: c.email } : {}) },
    items,
    ...(additionalCharges.length ? { additionalCharges } : {}),
    ...(p.terms.length ? { terms: [{ label: 'Terms and Conditions', terms: p.terms }] } : {}),
    ...(rich && p.notes?.trim() ? { notes: p.notes.trim().slice(0, 2000) } : {}),
    ...(p.sendEmail && c.email ? { email: { to: { name: c.attn || c.name || name, email: c.email } } } : {}),
  }
  return payload
}
/** Cipta dokumen (invois / sebut harga) dengan payload kaya dulu (description/unit/notes); 400 → ulang payload selamat. */
export async function createDocumentSmart(parts: InvoiceParts): Promise<{ invoice: RefrensInvoice; rich: boolean }> {
  const hasRich = parts.items.some(i => i.description || (i.unit && i.unit !== 'pcs')) || !!parts.notes?.trim()
  if (hasRich) {
    try { return { invoice: await createInvoice(buildInvoicePayload(parts, true)), rich: true } }
    catch (e) { if (!(e instanceof RefrensError && e.status === 400)) throw e }
  }
  return { invoice: await createInvoice(buildInvoicePayload(parts, false)), rich: false }
}
export const createInvoiceSmart = (parts: InvoiceParts) => createDocumentSmart({ ...parts, billType: 'INVOICE' })
/** Sebut harga website → sebut harga Refrens (nombor dari siri Refrens, cth STSB2026015xx). */
export function quotationPartsFromQuotation(q: Quotation): InvoiceParts {
  return { client: q.client, items: q.items, discount: q.discount, charges: q.charges, terms: q.terms, billType: 'QUOTATION', title: 'Quotation', dueDate: q.valid_until ?? undefined, notes: q.notes ?? null }
}
export function invoicePayloadFromQuotation(q: Quotation, opts: { dueDays?: number; title?: string } = {}) {
  return buildInvoicePayload({ client: q.client, items: q.items, discount: q.discount, charges: q.charges, terms: q.terms, dueDays: opts.dueDays, refNumber: q.quote_number, title: opts.title })
}

export async function createInvoice(payload: Record<string, unknown>): Promise<RefrensInvoice> {
  const { urlKey } = refrensConfig()!
  return call<RefrensInvoice>(paths.invoices(urlKey), { method: 'POST', body: JSON.stringify(payload) })
}
export async function getInvoice(id: string): Promise<RefrensInvoice> {
  const { urlKey } = refrensConfig()!
  return call<RefrensInvoice>(`${paths.invoices(urlKey)}/${encodeURIComponent(id)}`)
}
export async function listInvoices(limit = 5): Promise<{ total: number; data: RefrensInvoice[] }> {
  const { urlKey } = refrensConfig()!
  const r = await call<{ total?: number; data?: RefrensInvoice[] }>(`${paths.invoices(urlKey)}?$limit=${limit}&$sort[createdAt]=-1`)
  return { total: r.total ?? 0, data: r.data ?? [] }
}
/** Pastikan klien wujud di Refrens (cari ikut email/telefon, cipta jika tiada). */
export async function ensureClient(c: QuotationClient, clientIdRef: string): Promise<{ client: RefrensClient | null; created: boolean }> {
  if (!c.email && !c.phone) return { client: null, created: false }
  const found = await findClient({ email: c.email, phone: c.phone })
  if (found) return { client: found, created: false }
  const created = await createClient({
    clientId: clientIdRef, name: (c.company || c.name || 'Customer').trim(), email: c.email, phone: c.phone,
    street: c.address, tin: c.tin, regNo: c.reg_no, isCompany: !!c.company,
  })
  return { client: created, created: true }
}
export const ensureClientForQuotation = (q: Quotation) => ensureClient(q.client, `web-${q.customer_id ?? q.id}`)

// ── Bayaran & batal ─────────────────────────────────────────────────────────
export const PAYMENT_METHODS = ['ACCOUNT_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'DEBIT_CARD'] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]
export interface RefrensPayment { _id?: string; amount?: number; paymentDate?: string; paymentMethod?: string; refId?: string; notes?: string; isRemoved?: boolean; createdAt?: string }
export async function recordPayment(invoiceId: string, p: { amount: number; paymentDate: string; paymentMethod: PaymentMethod; refId?: string | null; notes?: string | null }, idempotencyKey?: string): Promise<RefrensPayment> {
  const { urlKey } = refrensConfig()!
  const body: Record<string, unknown> = { amount: r2(p.amount), paymentDate: p.paymentDate, paymentMethod: p.paymentMethod }
  if (p.refId) body.refId = p.refId.slice(0, 120)
  if (p.notes) body.notes = p.notes.slice(0, 500)
  return call<RefrensPayment>(`${paths.invoices(urlKey)}/${encodeURIComponent(invoiceId)}/payments`, { method: 'POST', body: JSON.stringify(body), headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {} })
}
export async function listPayments(invoiceId: string): Promise<RefrensPayment[]> {
  const { urlKey } = refrensConfig()!
  const r = await call<{ payments?: RefrensPayment[] } | RefrensPayment[]>(`${paths.invoices(urlKey)}/${encodeURIComponent(invoiceId)}/payments`)
  return Array.isArray(r) ? r : (r.payments ?? [])
}
export async function cancelInvoice(invoiceId: string, cancelPayment = false): Promise<RefrensInvoice> {
  const { urlKey } = refrensConfig()!
  return call<RefrensInvoice>(`${paths.invoices(urlKey)}/${encodeURIComponent(invoiceId)}?cancelPayment=${cancelPayment ? 'true' : 'false'}`, { method: 'PATCH', body: JSON.stringify({ status: 'CANCELED' }) })
}
export { SELLER as REFRENS_SELLER }

// ── Senarai dokumen (page admin "Invois Refrens", baca sahaja) ─────────────
// Penapis Feathers yang disahkan 24 Okt 2026: billType, status, invoiceNumber[$regex],
// billedTo.name[$regex], $limit/$skip/$sort/$select. (`q`/`$search` tidak disokong.)
export type RefrensBillType = 'INVOICE' | 'QUOTATION' | 'PROFORMA' | 'CREDITNOTE' | 'DEBITNOTE' | 'DELIVERYCHALLAN' | 'SALESORDER' | 'PURCHASEORDER' | string
export interface RefrensDocRow {
  id: string; billType: RefrensBillType; number: string; status: string
  date: string | null; dueDate: string | null; currency: string; total: number | null; paid: number
  clientName: string | null; clientEmail: string | null; createdAt: string | null
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
interface RawDoc { _id: string; billType?: string; invoiceNumber?: string; status?: string; invoiceDate?: string; dueDate?: string; currency?: string; finalTotal?: { total?: number }; billedTo?: { name?: string; email?: string }; payments?: { amount?: number; status?: string }[]; createdAt?: string }
function toRow(d: RawDoc): RefrensDocRow {
  const paid = (d.payments ?? []).reduce((s, p) => s + (Number(p?.amount) || 0), 0)
  return { id: d._id, billType: d.billType ?? 'INVOICE', number: d.invoiceNumber ?? '', status: d.status ?? '', date: d.invoiceDate ?? null, dueDate: d.dueDate ?? null, currency: d.currency ?? 'MYR', total: d.finalTotal?.total ?? null, paid, clientName: d.billedTo?.name ?? null, clientEmail: d.billedTo?.email ?? null, createdAt: d.createdAt ?? null }
}
export async function searchDocuments(opts: { billType?: string | null; status?: string | null; q?: string | null; limit?: number; skip?: number }): Promise<{ total: number; data: RefrensDocRow[] }> {
  const { urlKey } = refrensConfig()!
  const p = new URLSearchParams()
  p.set('$limit', String(Math.min(Math.max(opts.limit ?? 25, 1), 50)))
  p.set('$skip', String(Math.max(opts.skip ?? 0, 0)))
  p.set('$sort[invoiceDate]', '-1')
  // NOTA: jangan guna $select — dengan $select, finalTotal.total pulang 0 (disahkan 24 Okt).
  if (opts.billType) p.set('billType', opts.billType)
  if (opts.status) p.set('status', opts.status)
  const q = (opts.q ?? '').trim().slice(0, 60)
  if (q) {
    // Nombor dokumen (ada digit) → cari ikut nombor; selain itu nama klien.
    if (/\d/.test(q)) { p.set('invoiceNumber[$regex]', esc(q)); p.set('invoiceNumber[$options]', 'i') }
    else { p.set('billedTo.name[$regex]', esc(q)); p.set('billedTo.name[$options]', 'i') }
  }
  const r = await call<{ total?: number; data?: RawDoc[] }>(`${paths.invoices(urlKey)}?${p.toString()}`)
  return { total: r.total ?? 0, data: (r.data ?? []).map(toRow) }
}
/** Pautan buka dokumen dalam app Refrens (corak URL dari paparan pemilik: /app/<urlKey>/quotations/<id>). */
export function refrensAppUrl(doc: { id: string; billType: string }): string {
  const urlKey = process.env.REFRENS_URL_KEY?.trim() ?? ''
  const seg = doc.billType === 'QUOTATION' ? 'quotations' : doc.billType === 'PROFORMA' ? 'proformas' : doc.billType === 'CREDITNOTE' ? 'credit-notes' : 'invoices'
  return `https://www.refrens.com/app/${urlKey}/${seg}/${doc.id}`
}
