import type { SupabaseClient } from '@supabase/supabase-js'
import { upsertCustomer } from '@/lib/customers'
import { normalizePhone } from '@/lib/phone'
import { computeTotals, lineTotal, round2, round3 } from '@/lib/pos/money'
import { deductPosSaleStock } from '@/lib/pos/stock'
import { loadOpenShift } from '@/lib/pos/shifts'
import { stampSaleConsign } from '@/lib/pos/consign'
import { POS_PAY_METHODS, type PosPaymentInput, type PosSaleDetail, type PosSalePayload, type PosTicketLine } from '@/lib/pos/types'

// Cipta & lengkapkan jualan POS (server). Harga baris dari klien adalah muktamad (pelanggan dah
// bayar di kaunter) — server SAHKAN bentuk data, KIRA SEMULA jumlah dengan peraturan yang sama
// (lib/pos/money.ts) dan tolak kalau bayaran tak padan jumlah. Insert atomik + idempoten via RPC
// pos_create_sale (client_txn_id). Kesan sampingan selepas paid: stok (pek sahaja), CRM, promo.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export class PosSaleError extends Error { constructor(msg: string, public status = 400) { super(msg) } }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)
const optUuid = (v: unknown) => (isUuid(v) ? v : null)
const money = (v: unknown, max = 1_000_000) => { const x = Number(v); if (!Number.isFinite(x) || x < 0 || x > max) throw new PosSaleError('Invalid amount'); return round2(x) }

function cleanLines(raw: unknown): PosTicketLine[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new PosSaleError('No items in this sale')
  if (raw.length > 200) throw new PosSaleError('Too many lines')
  return raw.map((l, i) => {
    const o = (l ?? {}) as Record<string, unknown>
    const unit = o.unit === 'kg' ? 'kg' : 'pcs'
    const qtyN = Number(o.qty)
    if (!Number.isFinite(qtyN) || qtyN <= 0 || qtyN > 100_000) throw new PosSaleError(`Invalid quantity on line ${i + 1}`)
    const qty = unit === 'kg' ? round3(qtyN) : Math.round(qtyN)
    if (qty <= 0) throw new PosSaleError(`Invalid quantity on line ${i + 1}`)
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 160) : ''
    if (!name) throw new PosSaleError(`Empty item name on line ${i + 1}`)
    return {
      lineId: typeof o.lineId === 'string' ? o.lineId : `${i}`,
      productId: optUuid(o.productId), variantId: optUuid(o.variantId),
      name, variantName: typeof o.variantName === 'string' ? o.variantName.slice(0, 80) : null,
      unit, qty,
      unitPrice: money(o.unitPrice),
      catalogPrice: o.catalogPrice == null ? null : money(o.catalogPrice),
      lineDiscount: money(o.lineDiscount ?? 0),
      sellByWeight: unit === 'kg',
      sku: typeof o.sku === 'string' ? o.sku.slice(0, 80) : null,
      barcode: typeof o.barcode === 'string' ? o.barcode.slice(0, 80) : null,
    }
  })
}

function cleanPayments(raw: unknown): PosPaymentInput[] {
  if (!Array.isArray(raw)) return []
  if (raw.length > 4) throw new PosSaleError('Too many payments')
  return raw.map(p => {
    const o = (p ?? {}) as Record<string, unknown>
    if (!POS_PAY_METHODS.includes(o.method as never)) throw new PosSaleError('Invalid payment method')
    const status = o.status === 'pending' ? 'pending' : 'paid'
    return {
      method: o.method as PosPaymentInput['method'],
      amount: money(o.amount),
      tendered: o.tendered == null ? null : money(o.tendered),
      change_given: o.change_given == null ? null : money(o.change_given),
      ref: typeof o.ref === 'string' ? o.ref.trim().slice(0, 80) || null : null,
      status,
    }
  })
}

export interface CreateSaleCtx { userId: string; cashierId: string | null }
export interface CreateSaleResult { id: string; receipt_no: string | null; status: 'pending' | 'paid'; duplicate: boolean }

export async function createSale(sb: SB, body: unknown, ctx: CreateSaleCtx): Promise<CreateSaleResult> {
  const b = (body ?? {}) as Partial<PosSalePayload> & Record<string, unknown>
  if (!isUuid(b.client_txn_id)) throw new PosSaleError('client_txn_id (uuid) required')

  const lines = cleanLines(b.lines)
  const payments = cleanPayments(b.payments)
  const discount = b.discount && typeof b.discount === 'object'
    ? { type: (b.discount as { type?: string }).type === 'pct' ? 'pct' as const : 'rm' as const, value: money((b.discount as { value?: unknown }).value ?? 0), note: typeof (b.discount as { note?: unknown }).note === 'string' ? String((b.discount as { note?: unknown }).note).slice(0, 120) : null }
    : null
  const promo = b.promo && typeof b.promo === 'object' && isUuid((b.promo as { id?: unknown }).id)
    ? { id: (b.promo as { id: string }).id, code: String((b.promo as { code?: unknown }).code ?? '').slice(0, 40), discount: money((b.promo as { discount?: unknown }).discount ?? 0) }
    : null

  const hasCash = payments.some(p => p.method === 'cash')
  const totals = computeTotals(lines, discount, promo?.discount ?? 0, { cashRounding: hasCash })

  const paidTotal = round2(payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0))
  const pendingTotal = round2(payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0))
  const covered = round2(paidTotal + pendingTotal)
  if (payments.length === 0) throw new PosSaleError('No payment given')
  if (Math.abs(covered - totals.total) > 0.011) throw new PosSaleError(`Payments total (${covered.toFixed(2)}) does not match sale total (${totals.total.toFixed(2)})`)
  const status: 'pending' | 'paid' = pendingTotal > 0 ? 'pending' : 'paid'
  const changeGiven = round2(payments.reduce((s, p) => s + (p.change_given ?? 0), 0))

  const customer = b.customer && typeof b.customer === 'object' ? (b.customer as { phone?: unknown; name?: unknown; id?: unknown }) : null
  const phoneNorm = customer ? normalizePhone(typeof customer.phone === 'string' ? customer.phone : null) : ''
  const soldAt = typeof b.sold_at === 'string' && !Number.isNaN(Date.parse(b.sold_at)) ? new Date(b.sold_at).toISOString() : null

  // Shift: guna shift_id klien jika ada; jika tidak, shift terbuka register ini (buka/tutup kedai). Tiada shift → null (jualan tetap lulus).
  const registerId = optUuid(b.register_id)
  let shiftId = optUuid(b.shift_id)
  if (!shiftId && registerId) shiftId = (await loadOpenShift(sb, registerId).catch(() => null))?.id ?? null

  const payload = {
    client_txn_id: b.client_txn_id,
    local_ref: typeof b.local_ref === 'string' ? b.local_ref.slice(0, 40) : null,
    register_id: registerId, shift_id: shiftId,
    cashier_id: ctx.cashierId, created_by: ctx.userId,
    customer_id: customer ? optUuid(customer.id) : null,
    customer_phone: phoneNorm || null,
    customer_name: customer && typeof customer.name === 'string' ? customer.name.trim().slice(0, 120) || null : null,
    status,
    subtotal: totals.subtotal, discount_total: totals.discountTotal, discount_note: discount?.note ?? null,
    promo_code_id: promo?.id ?? null, promo_code: promo?.code ?? null, promo_discount: totals.promoDiscount,
    rounding_adj: totals.roundingAdj, total: totals.total, paid_total: paidTotal, change_given: changeGiven,
    weight_kg_total: totals.weightKg,
    sold_at: soldAt, offline: !!b.offline,
    note: typeof b.note === 'string' ? b.note.trim().slice(0, 300) || null : null,
    items: lines.map((l, i) => ({
      sort: i, product_id: l.productId, variant_id: l.variantId, name: l.name, variant_name: l.variantName,
      sku: l.sku, barcode: l.barcode, sell_by_weight: l.unit === 'kg', qty: l.qty, unit: l.unit,
      unit_price: l.unitPrice, catalog_price: l.catalogPrice, line_discount: l.lineDiscount, line_total: lineTotal(l),
    })),
    payments: payments.map(p => ({ method: p.method, amount: p.amount, tendered: p.tendered, change_given: p.change_given, ref: p.ref, status: p.status })),
  }

  const { data, error } = await sb.rpc('pos_create_sale', { p: payload })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new PosSaleError('Migration 155 (POS) has not been run', 503)
    throw new PosSaleError(error.message, 500)
  }
  const r = data as { id: string; receipt_no: string | null; status: 'pending' | 'paid'; duplicate: boolean }
  // Konsainan (migration 158): snapshot pembekal + jumlah perlu dibayar pada baris. Gagal/tiada 158 → jualan tetap sah.
  if (!r.duplicate) await stampSaleConsign(sb, r.id).catch(e => console.error('[pos-sale] cop konsainan gagal', e instanceof Error ? e.message : e))
  if (!r.duplicate && r.status === 'paid') await afterSalePaid(sb, r.id, { phone: phoneNorm || null, name: payload.customer_name, promoId: promo?.id ?? null })
  return r
}

/** Kesan sampingan selepas jualan dibayar penuh — setiap satu idempoten / best-effort. */
export async function afterSalePaid(sb: SB, saleId: string, ctx: { phone: string | null; name: string | null; promoId: string | null }) {
  await deductPosSaleStock(sb, saleId)
  if (ctx.phone) {
    await upsertCustomer({ phone: ctx.phone, source: 'pos', name: ctx.name, lastOrderAt: new Date().toISOString() })
    const { data: c } = await sb.from('customers').select('id').eq('phone_norm', ctx.phone).maybeSingle()
    if (c?.id) await sb.from('pos_sales').update({ customer_id: c.id }).eq('id', saleId).is('customer_id', null)
  }
  if (ctx.promoId) {
    const { error } = await sb.rpc('increment_promo_uses', { promo_id: ctx.promoId })
    if (error) console.error('[pos-sale] promo uses gagal', error.message)
  }
}

/** Tandakan jualan pending → paid (CHIP / sahkan manual) lalu jalankan kesan sampingan. Sekali sahaja. */
export async function markSalePaid(sb: SB, saleId: string): Promise<'paid' | 'already' | 'notfound'> {
  const { data: rows, error } = await sb
    .from('pos_sales')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', saleId)
    .eq('status', 'pending')
    .select('id, customer_phone, customer_name, promo_code_id, paid_total, total')
  if (error) throw new PosSaleError(error.message, 500)
  const s = rows?.[0]
  if (!s) {
    const { data: exists } = await sb.from('pos_sales').select('id').eq('id', saleId).maybeSingle()
    return exists ? 'already' : 'notfound'
  }
  await sb.from('pos_sales').update({ paid_total: s.total }).eq('id', saleId)
  await afterSalePaid(sb, saleId, { phone: s.customer_phone, name: s.customer_name, promoId: s.promo_code_id })
  return 'paid'
}

export async function loadSaleDetail(sb: SB, where: { id?: string; token?: string }): Promise<PosSaleDetail | null> {
  let q = sb.from('pos_sales').select('*, pos_cashiers!cashier_id(name), pos_registers(code)')   // !cashier_id: pos_sales ada 2 FK ke pos_cashiers (voided_by juga)
  q = where.id ? q.eq('id', where.id) : q.eq('public_token', where.token ?? '')
  const { data: sale, error } = await q.maybeSingle()
  if (error || !sale) return null
  const [{ data: items }, { data: payments }] = await Promise.all([
    sb.from('pos_sale_items').select('*').eq('sale_id', sale.id).order('sort'),
    sb.from('pos_payments').select('*').eq('sale_id', sale.id).order('created_at'),
  ])
  const { pos_cashiers, pos_registers, ...rest } = sale as Record<string, unknown> & { pos_cashiers?: { name: string } | null; pos_registers?: { code: string } | null }
  return {
    sale: rest as unknown as PosSaleDetail['sale'],
    items: (items ?? []) as PosSaleDetail['items'],
    payments: (payments ?? []) as PosSaleDetail['payments'],
    cashierName: pos_cashiers?.name ?? null,
    registerCode: pos_registers?.code ?? null,
  }
}
