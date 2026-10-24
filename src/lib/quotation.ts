// Modul Sebut Harga (quotation) — jenis, lalai, pengiraan & pra-isi. Pure (boleh
// diimport klien & server). Jadual `quotations` (migration 146); lihat
// docs/plan-sebut-harga.md. Bahasa dokumen: English (amalan semasa klien korporat).
import { finishLabel } from '@/lib/gift'
import { DEFAULT_BANK_KEY } from '@/lib/seller'

export type QuotationStatus = 'draft' | 'issued' | 'accepted' | 'rejected' | 'expired' | 'cancelled' | 'converted'
export const QUOTATION_STATUSES: { id: QuotationStatus; label: string }[] = [
  { id: 'draft',     label: 'Draf' },
  { id: 'issued',    label: 'Dikeluarkan' },
  { id: 'accepted',  label: 'Diterima' },
  { id: 'rejected',  label: 'Ditolak' },
  { id: 'expired',   label: 'Luput' },
  { id: 'cancelled', label: 'Dibatalkan' },
  { id: 'converted', label: 'Jadi invois' },
]
export const statusLabel = (s: string) => QUOTATION_STATUSES.find(x => x.id === s)?.label ?? s

export interface QuotationItem { name: string; description: string | null; qty: number; unit: string; rate: number }
export interface QuotationCharge { label: string; amount: number }
export interface QuotationCustomField { label: string; value: string }
export interface QuotationClient {
  company?: string | null; name?: string | null; reg_no?: string | null; tin?: string | null
  address?: string | null; email?: string | null; phone?: string | null; attn?: string | null
}
export interface Quotation {
  id: string
  quote_number: string | null
  status: QuotationStatus
  issued_at: string | null
  valid_until: string | null
  customer_id: string | null
  client: QuotationClient
  source_type: string | null
  source_id: string | null
  items: QuotationItem[]
  subtotal: number
  discount: number
  charges: QuotationCharge[]
  total: number
  currency: string
  terms: string[]
  notes: string | null
  show_bank: boolean
  bank_key: string
  custom_fields: QuotationCustomField[]
  share_token: string | null
  accepted_at: string | null
  accepted_by: string | null
  cancel_reason: string | null
  legacy_source: string | null
  created_at: string
  updated_at: string
}
export interface QuotationEvent { id: number; type: string; meta: Record<string, unknown>; actor: string | null; created_at: string }

// Rujukan invois Refrens (fasa 2) — disimpan dalam meta event 'converted' / 'invoice_synced'
// (tiada lajur baharu). Event terbaharu menang.
export interface QuotationInvoiceRef { id: string; number: string; status: string; total: number | null; pdf: string | null; link: string | null; created_at: string; synced_at: string }
/** Rujukan sebut harga Refrens (pilihan 1 pemilik, 24 Okt): event 'refrens_quotation' terbaharu. */
export function refrensQuotationRefFromEvents(events: QuotationEvent[] | null | undefined): QuotationInvoiceRef | null {
  if (!events?.length) return null
  const ev = [...events].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).find(e => e.type === 'refrens_quotation' && (e.meta as { quotation?: unknown })?.quotation)
  return ev ? ((ev.meta as { quotation: QuotationInvoiceRef }).quotation) : null
}
export function invoiceRefFromEvents(events: QuotationEvent[] | null | undefined): QuotationInvoiceRef | null {
  if (!events?.length) return null
  const sorted = [...events].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const ev = sorted.find(e => (e.type === 'converted' || e.type === 'invoice_synced') && e.meta && typeof e.meta === 'object' && (e.meta as { invoice?: unknown }).invoice)
  return ev ? ((ev.meta as { invoice: QuotationInvoiceRef }).invoice) : null
}

// Lalai (disalin dari sebut harga Refrens pemilik, 24 Okt 2026).
export const DEFAULT_TERMS = [
  'All prices are subject to change without notice and are not guaranteed, except that prices for an order that have been accepted.',
  'Prices quoted are based on current market rates and are subject to change without prior notice.',
  '50% advance payment upon confirmation to proceed. Remaining 50% payable upon successful delivery of goods.',
]
export const DEFAULT_NOTE = 'Thank you for your enquiry. We are pleased to submit our quotation as above. Should you require any clarification, please do not hesitate to contact us.'
export const VALID_DAYS = 14
export const UNITS = ['pcs', 'box', 'kg', 'pack', 'ctn', 'set', 'trip', 'lot', 'unit']
export const EDITABLE_STATUSES: QuotationStatus[] = ['draft', 'issued']

const round2 = (n: number) => Math.round(n * 100) / 100
export const rm = (n: unknown) => `RM ${Number(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function calcTotals(items: QuotationItem[], discount: number, charges: QuotationCharge[]) {
  const subtotal = round2(items.reduce((s, i) => s + Number(i.qty) * Number(i.rate), 0))
  const chargesTotal = round2(charges.reduce((s, c) => s + Number(c.amount), 0))
  const disc = round2(Math.min(Math.max(Number(discount) || 0, 0), subtotal))
  return { subtotal, chargesTotal, discount: disc, total: round2(subtotal - disc + chargesTotal) }
}

export function isEditable(q: Pick<Quotation, 'status'>): boolean { return EDITABLE_STATUSES.includes(q.status) }
export function isExpired(q: Pick<Quotation, 'status' | 'valid_until'>): boolean {
  if (q.status !== 'issued' || !q.valid_until) return false
  return new Date(q.valid_until + 'T23:59:59') < new Date()
}
export function clientDisplayName(c: QuotationClient | null | undefined): string {
  return (c?.company || c?.name || '').trim() || '—'
}
export function addDays(d: Date, days: number): string {
  const x = new Date(d); x.setDate(x.getDate() + days)
  return x.toISOString().slice(0, 10)
}

// ── Pengesahan input (server & klien) ──────────────────────────────────────
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : NaN }

export function sanitizeItems(raw: unknown): QuotationItem[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 60).map(r => {
    const o = (r ?? {}) as Record<string, unknown>
    return { name: str(o.name, 200), description: str(o.description, 1000) || null, qty: num(o.qty), unit: str(o.unit, 20) || 'pcs', rate: round2(num(o.rate)) }
  }).filter(i => i.name && Number.isFinite(i.qty) && i.qty > 0 && Number.isFinite(i.rate) && i.rate >= 0)
}
export function sanitizeCharges(raw: unknown): QuotationCharge[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 10).map(r => { const o = (r ?? {}) as Record<string, unknown>; return { label: str(o.label, 80), amount: round2(num(o.amount)) } })
    .filter(c => c.label && Number.isFinite(c.amount) && c.amount >= 0)
}
export function sanitizeCustomFields(raw: unknown): QuotationCustomField[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 10).map(r => { const o = (r ?? {}) as Record<string, unknown>; return { label: str(o.label, 60), value: str(o.value, 200) } }).filter(f => f.label)
}
export function sanitizeTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 15).map(t => str(t, 500)).filter(Boolean)
}
export function sanitizeClient(raw: unknown): QuotationClient {
  const o = (raw ?? {}) as Record<string, unknown>
  const c: QuotationClient = {
    company: str(o.company, 160) || null, name: str(o.name, 120) || null, reg_no: str(o.reg_no, 40) || null, tin: str(o.tin, 30) || null,
    address: str(o.address, 400) || null, email: str(o.email, 160) || null, phone: str(o.phone, 30) || null, attn: str(o.attn, 120) || null,
  }
  return c
}

// Terma deposit ikut peratus (ganti baris 3 lalai bila bukan 50%).
export function depositTerm(pct: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return `${p}% advance payment upon confirmation to proceed. Remaining ${100 - p}% payable upon successful delivery of goods.`
}
export function termsForDeposit(pct: number): string[] {
  return [DEFAULT_TERMS[0], DEFAULT_TERMS[1], depositTerm(pct)]
}

// ── Pra-isi dari gift order (gift_orders + katalog) ───────────────────────
export interface GiftOrderLike {
  id: string; order_number: string; name: string; phone: string; email: string | null; company: string | null
  address: string | null; postcode: string | null; quantity: number; unit_price: number; delivery_fee: number
  deposit_pct: number; config: Record<string, unknown> | null
}
export interface GiftCatalogNames { boxes: { id: string; name: string }[]; fillings: { id: string; name: string }[]; designs: { id: string; name: string }[] }

export function quotationFromGiftOrder(o: GiftOrderLike, cat: GiftCatalogNames): Partial<Quotation> & { items: QuotationItem[] } {
  const cfg = (o.config ?? {}) as Record<string, unknown>
  const weight = typeof cfg.weight === 'string' ? cfg.weight : null
  const items: QuotationItem[] = []
  const desc: string[] = []
  let name = 'Custom Gift Box Kurma'
  if (typeof cfg.kurma_name === 'string' && cfg.kurma_name) {
    name = `Custom Gift Box Kurma${weight ? ` ${weight}` : ''} — ${cfg.kurma_name}`
  } else {
    const box = cat.boxes.find(b => b.id === cfg.box_id)
    if (box) name = `${box.name}${weight ? ` ${weight}` : ''}`
    const fills = Array.isArray(cfg.fillings) ? (cfg.fillings as { id: string; qty: number }[]) : []
    const fillNames = fills.map(f => { const n = cat.fillings.find(x => x.id === f.id)?.name; return n ? `${n} × ${f.qty}` : null }).filter(Boolean)
    if (fillNames.length) desc.push(`Filling: ${fillNames.join(', ')}`)
  }
  if (typeof cfg.finishing === 'string' && cfg.finishing) desc.push(`Finishing: ${finishLabel(cfg.finishing)}`)
  if (typeof cfg.template_name === 'string' && cfg.template_name) desc.push(`Design: ${cfg.template_name} with client logo`)
  else if (cfg.full_design_url) desc.push('Design: client-supplied artwork')
  else {
    const d = cat.designs.find(x => x.id === cfg.design_id)
    if (d) desc.push(`Design: ${d.name}`)
  }
  desc.push('Custom printed box, filled, sealed and ready to deliver.')
  items.push({ name, description: desc.join(' · '), qty: Math.max(1, Number(o.quantity) || 1), unit: 'box', rate: round2(Number(o.unit_price) || 0) })
  if (Number(o.delivery_fee) > 0) items.push({ name: 'Delivery', description: null, qty: 1, unit: 'trip', rate: round2(Number(o.delivery_fee)) })

  const address = [o.address, o.postcode].filter(Boolean).join(', ') || null
  return {
    client: { company: o.company || null, name: o.name, phone: o.phone, email: o.email, address, attn: o.company ? o.name : null },
    items,
    source_type: 'gift_order', source_id: o.id,
    terms: termsForDeposit(Number(o.deposit_pct) || 50),
    notes: `${DEFAULT_NOTE} Ref: ${o.order_number}.`,
    bank_key: DEFAULT_BANK_KEY, show_bank: true,
  }
}

export function emptyQuotation(): Partial<Quotation> & { items: QuotationItem[] } {
  return { client: {}, items: [{ name: '', description: null, qty: 1, unit: 'pcs', rate: 0 }], discount: 0, charges: [], terms: [...DEFAULT_TERMS], notes: DEFAULT_NOTE, show_bank: true, bank_key: DEFAULT_BANK_KEY, custom_fields: [], valid_until: addDays(new Date(), VALID_DAYS) }
}
