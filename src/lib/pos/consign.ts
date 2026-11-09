import type { SupabaseClient } from '@supabase/supabase-js'
import { round2, round3 } from '@/lib/pos/money'
import { fetchAll } from '@/lib/pos/shifts'

// Konsainan POS (migration 158): barang pembekal lain dijual di kedai kita.
//  • Pembekal (pos_consignors) ada terma lalai: 'commission' (kedai ambil commission_pct, baki dibayar) atau
//    'cost' (bayar kos seunit yang ditetapkan).
//  • Produk dipaut ke pembekal pada baris produk pos_product_settings (variant_id null): consignor_id,
//    consign_commission_pct (override), consign_cost (kos lalai seunit / per kg). Baris varian: consign_cost varian.
//  • Semasa jual, jumlah perlu dibayar DISNAPSHOT pada pos_sale_items (consignor_id, consign_payable) — perubahan
//    terma kemudian tidak mengubah jualan lama. Kos belum diisi → consign_payable null ("missing cost").
//  • Penyata (pos_consign_settlements) menandakan baris (consign_settlement_id) supaya dibayar sekali sahaja.
// Semua fungsi toleran bila 158 belum dijalankan (null / 0) supaya jualan & dashboard tidak rosak.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
export class ConsignError extends Error { constructor(message: string, public status = 400) { super(message) } }

export interface Consignor {
  id: string; name: string; phone: string | null; payout_type: 'cost' | 'commission'; commission_pct: number
  bank_name: string | null; bank_account: string | null; bank_holder: string | null; note: string | null; is_active: boolean; created_at: string
}
interface TermRow { product_id: string; variant_id: string | null; consignor_id: string | null; consign_cost: number | string | null; consign_commission_pct: number | string | null }
interface ProductTerms { consignor: Consignor; commissionPct: number | null; cost: number | null; variantCost: Map<string, number> }
export type ConsignTerms = Map<string, ProductTerms>

const chunk = <T,>(arr: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
const numOrNull = (v: number | string | null | undefined) => (v == null ? null : Number(v))

/** Terma konsainan untuk senarai produk. null = migration 158 belum dijalankan. */
export async function loadConsignTerms(sb: SB, productIds: (string | null | undefined)[]): Promise<ConsignTerms | null> {
  const ids = Array.from(new Set(productIds.filter(isUuid)))
  const terms: ConsignTerms = new Map()
  if (ids.length === 0) return terms
  const rows: TermRow[] = []
  for (const part of chunk(ids, 100)) {
    const { data, error } = await sb.from('pos_product_settings').select('product_id, variant_id, consignor_id, consign_cost, consign_commission_pct').in('product_id', part)
    if (error) return null
    rows.push(...((data ?? []) as TermRow[]))
  }
  const productRows = rows.filter(r => r.variant_id === null && r.consignor_id)
  if (productRows.length === 0) return terms
  const { data: cons, error: cErr } = await sb.from('pos_consignors').select('*').in('id', Array.from(new Set(productRows.map(r => r.consignor_id as string))))
  if (cErr) return null
  const consMap = new Map(((cons ?? []) as Consignor[]).map(c => [c.id, { ...c, commission_pct: Number(c.commission_pct) }]))
  for (const pr of productRows) {
    const consignor = consMap.get(pr.consignor_id as string)
    if (!consignor) continue
    const variantCost = new Map<string, number>()
    for (const r of rows) if (r.product_id === pr.product_id && r.variant_id && r.consign_cost != null) variantCost.set(r.variant_id, Number(r.consign_cost))
    terms.set(pr.product_id, { consignor, commissionPct: numOrNull(pr.consign_commission_pct), cost: numOrNull(pr.consign_cost), variantCost })
  }
  return terms
}

/** Jumlah perlu dibayar kepada pembekal untuk satu baris jualan. null = bukan produk konsainan. payable null = kos belum diisi. */
export function consignPayable(terms: ConsignTerms, line: { productId: string | null; variantId: string | null; qty: number; lineTotal: number }): { consignorId: string; payable: number | null } | null {
  if (!line.productId) return null
  const t = terms.get(line.productId)
  if (!t) return null
  if (t.consignor.payout_type === 'commission') {
    const pct = t.commissionPct ?? t.consignor.commission_pct
    return { consignorId: t.consignor.id, payable: round2(Math.max(0, line.lineTotal) * (1 - pct / 100)) }
  }
  const unitCost = (line.variantId ? t.variantCost.get(line.variantId) : undefined) ?? t.cost
  return { consignorId: t.consignor.id, payable: unitCost == null ? null : round2(line.qty * unitCost) }
}

interface StampItem { id: string; product_id: string | null; variant_id: string | null; qty: number | string; line_total: number | string }

/** Cop baris sesuatu jualan dengan pembekal + jumlah perlu dibayar (dipanggil selepas jualan dicipta). Pulang bilangan baris dicop. */
export async function stampSaleConsign(sb: SB, saleId: string): Promise<number> {
  const { data, error } = await sb.from('pos_sale_items').select('id, product_id, variant_id, qty, line_total').eq('sale_id', saleId)
  if (error || !data?.length) return 0
  const items = data as StampItem[]
  const terms = await loadConsignTerms(sb, items.map(i => i.product_id))
  if (!terms || terms.size === 0) return 0
  let n = 0
  for (const it of items) {
    const r = consignPayable(terms, { productId: it.product_id, variantId: it.variant_id, qty: Number(it.qty), lineTotal: Number(it.line_total) })
    if (!r) continue
    const { error: uErr } = await sb.from('pos_sale_items').update({ consignor_id: r.consignorId, consign_payable: r.payable }).eq('id', it.id)
    if (!uErr) n++
  }
  return n
}

/** Kira semula semua baris BELUM diselesaikan bagi produk pembekal ini guna terma semasa (jualan sebelum produk dipaut / kos baru diisi). */
export async function restampUnsettled(sb: SB, consignorId: string): Promise<{ lines: number; missingCost: number }> {
  const { data: assigned, error } = await sb.from('pos_product_settings').select('product_id').eq('consignor_id', consignorId).is('variant_id', null)
  if (error) throw new ConsignError(error.message, 500)
  const productIds = Array.from(new Set(((assigned ?? []) as { product_id: string }[]).map(r => r.product_id)))
  if (productIds.length === 0) return { lines: 0, missingCost: 0 }
  const terms = await loadConsignTerms(sb, productIds)
  if (!terms) throw new ConsignError('Migration 158 (consignment) has not been run', 503)
  let lines = 0, missingCost = 0
  for (const part of chunk(productIds, 50)) {
    const items = await fetchAll<StampItem>((f, t) => sb.from('pos_sale_items').select('id, product_id, variant_id, qty, line_total').in('product_id', part).is('consign_settlement_id', null).order('id').range(f, t))
    for (const group of chunk(items, 20)) {
      await Promise.all(group.map(async it => {
        const r = consignPayable(terms, { productId: it.product_id, variantId: it.variant_id, qty: Number(it.qty), lineTotal: Number(it.line_total) })
        if (!r || r.consignorId !== consignorId) return
        const { error: uErr } = await sb.from('pos_sale_items').update({ consignor_id: r.consignorId, consign_payable: r.payable }).eq('id', it.id)
        if (!uErr) { lines++; if (r.payable == null) missingCost++ }
      }))
    }
  }
  return { lines, missingCost }
}

export interface ConsignReportRow { key: string; name: string; variant: string | null; unit: 'pcs' | 'kg'; qty: number; sales: number; payable: number; commission: number; lines: number; missingCost: number }
export interface ConsignReport {
  rows: ConsignReportRow[]
  totals: { lines: number; sales: number; payable: number; commission: number; missingCost: number }
  firstSold: string | null; lastSold: string | null
  itemIds: string[]
}
const klStart = (ymd: string) => new Date(`${ymd}T00:00:00+08:00`).toISOString()
const klEndExclusive = (ymd: string) => new Date(new Date(`${ymd}T00:00:00+08:00`).getTime() + 86400_000).toISOString()

/** Jualan konsainan (jualan paid sahaja). settlementId → baris penyata itu; jika tidak → baris BELUM diselesaikan dalam julat. */
export async function buildConsignReport(sb: SB, consignorId: string, opts: { from?: string | null; to?: string | null; settlementId?: string | null } = {}): Promise<ConsignReport> {
  type Row = { id: string; name: string; variant_name: string | null; unit: 'pcs' | 'kg'; qty: number | string; line_total: number | string; consign_payable: number | string | null; pos_sales: { sold_at: string } | { sold_at: string }[] }
  const items = await fetchAll<Row>((f, t) => {
    let q = sb.from('pos_sale_items').select('id, name, variant_name, unit, qty, line_total, consign_payable, pos_sales!inner(status, sold_at)').eq('consignor_id', consignorId).eq('pos_sales.status', 'paid').order('id').range(f, t)
    if (opts.settlementId) q = q.eq('consign_settlement_id', opts.settlementId)
    else {
      q = q.is('consign_settlement_id', null)
      if (opts.from) q = q.gte('pos_sales.sold_at', klStart(opts.from))
      if (opts.to) q = q.lt('pos_sales.sold_at', klEndExclusive(opts.to))
    }
    return q
  })
  const map = new Map<string, ConsignReportRow>()
  let first: string | null = null, last: string | null = null
  for (const it of items) {
    const variant = it.variant_name && it.variant_name !== 'ikut berat' ? it.variant_name : null
    const key = `${it.name}|${variant ?? ''}|${it.unit}`
    const cur = map.get(key) ?? { key, name: it.name, variant, unit: it.unit, qty: 0, sales: 0, payable: 0, commission: 0, lines: 0, missingCost: 0 }
    const sale = Number(it.line_total)
    cur.qty = it.unit === 'kg' ? round3(cur.qty + Number(it.qty)) : cur.qty + Number(it.qty)
    cur.sales = round2(cur.sales + sale); cur.lines += 1
    if (it.consign_payable == null) cur.missingCost += 1
    else { cur.payable = round2(cur.payable + Number(it.consign_payable)); cur.commission = round2(cur.commission + sale - Number(it.consign_payable)) }
    map.set(key, cur)
    const s = Array.isArray(it.pos_sales) ? it.pos_sales[0] : it.pos_sales
    if (s?.sold_at) { if (!first || s.sold_at < first) first = s.sold_at; if (!last || s.sold_at > last) last = s.sold_at }
  }
  const rows = Array.from(map.values()).sort((a, b) => b.sales - a.sales)
  return {
    rows,
    totals: { lines: items.length, sales: round2(rows.reduce((a, r) => a + r.sales, 0)), payable: round2(rows.reduce((a, r) => a + r.payable, 0)), commission: round2(rows.reduce((a, r) => a + r.commission, 0)), missingCost: rows.reduce((a, r) => a + r.missingCost, 0) },
    firstSold: first, lastSold: last, itemIds: items.map(i => i.id),
  }
}

export interface ConsignSettlement {
  id: string; doc_no: string | null; consignor_id: string; period_from: string; period_to: string; lines: number
  sales_total: number; payable_total: number; commission_total: number; status: 'unpaid' | 'paid'; paid_at: string | null; pay_ref: string | null; note: string | null; created_at: string
  pos_consignors?: Consignor | null
}

/** Cipta penyata: bekukan jumlah + tandakan baris supaya tidak dibayar dua kali. */
export async function createSettlement(sb: SB, p: { consignorId: string; from: string; to: string; note?: string | null; userId: string | null }): Promise<ConsignSettlement> {
  if (p.from > p.to) throw new ConsignError('Period start must be on or before the end')
  const report = await buildConsignReport(sb, p.consignorId, { from: p.from, to: p.to })
  if (report.totals.lines === 0) throw new ConsignError('No unsettled consignment sales in this period')
  if (report.totals.missingCost > 0) throw new ConsignError(`${report.totals.missingCost} sale line${report.totals.missingCost === 1 ? ' has' : 's have'} no cost set. Set the product cost, then press Recalculate.`)
  const { data: docNo, error: nErr } = await sb.rpc('pos_next_consign_no')
  if (nErr) throw new ConsignError(nErr.message, 500)
  const { data: s, error } = await sb.from('pos_consign_settlements').insert({
    doc_no: docNo, consignor_id: p.consignorId, period_from: p.from, period_to: p.to, lines: report.totals.lines,
    sales_total: report.totals.sales, payable_total: report.totals.payable, commission_total: report.totals.commission,
    note: p.note?.trim().slice(0, 300) || null, created_by: p.userId,
  }).select('*').single()
  if (error) throw new ConsignError(error.message, 500)
  for (const part of chunk(report.itemIds, 200)) {
    const { error: uErr } = await sb.from('pos_sale_items').update({ consign_settlement_id: s.id }).in('id', part).is('consign_settlement_id', null)
    if (uErr) throw new ConsignError(uErr.message, 500)
  }
  return s as ConsignSettlement
}

export async function deleteSettlement(sb: SB, id: string): Promise<void> {
  const { data: s } = await sb.from('pos_consign_settlements').select('id, status').eq('id', id).maybeSingle()
  if (!s) throw new ConsignError('Statement not found', 404)
  if (s.status === 'paid') throw new ConsignError('A paid statement cannot be deleted. Mark it unpaid first.', 409)
  const { error: uErr } = await sb.from('pos_sale_items').update({ consign_settlement_id: null }).eq('consign_settlement_id', id)
  if (uErr) throw new ConsignError(uErr.message, 500)
  const { error } = await sb.from('pos_consign_settlements').delete().eq('id', id)
  if (error) throw new ConsignError(error.message, 500)
}

export interface ConsignStockBalance { key: string; product_id: string; variant_id: string | null; name: string; variant: string | null; unit: 'pcs' | 'kg'; received: number; returned: number; sold: number; balance: number }

/** Baki barang pembekal = diterima − dipulangkan − terjual (jualan paid). */
export async function consignStockBalance(sb: SB, consignorId: string): Promise<ConsignStockBalance[]> {
  type Move = { product_id: string; variant_id: string | null; unit: 'pcs' | 'kg'; qty: number | string; type: 'in' | 'return'; products: { name: string } | null; product_variants: { name: string } | null }
  type Sold = { product_id: string | null; variant_id: string | null; name: string; variant_name: string | null; unit: 'pcs' | 'kg'; qty: number | string }
  const [moves, sold] = await Promise.all([
    fetchAll<Move>((f, t) => sb.from('pos_consign_stock_moves').select('product_id, variant_id, unit, qty, type, products(name), product_variants(name)').eq('consignor_id', consignorId).order('id').range(f, t)),
    fetchAll<Sold>((f, t) => sb.from('pos_sale_items').select('product_id, variant_id, name, variant_name, unit, qty, pos_sales!inner(status)').eq('consignor_id', consignorId).eq('pos_sales.status', 'paid').order('id').range(f, t)),
  ])
  const map = new Map<string, ConsignStockBalance>()
  const get = (pid: string, vid: string | null, unit: 'pcs' | 'kg', name: string, variant: string | null) => {
    const key = `${pid}|${vid ?? ''}|${unit}`
    if (!map.has(key)) map.set(key, { key, product_id: pid, variant_id: vid, name, variant, unit, received: 0, returned: 0, sold: 0, balance: 0 })
    return map.get(key)!
  }
  for (const m of moves) {
    const r = get(m.product_id, m.variant_id, m.unit, m.products?.name ?? m.product_id.slice(0, 8), m.variant_id ? (m.product_variants?.name ?? null) : null)
    if (m.type === 'in') r.received = round3(r.received + Number(m.qty)); else r.returned = round3(r.returned + Number(m.qty))
  }
  for (const s of sold) {
    if (!s.product_id) continue
    // jualan timbang direkod variant_id null + unit kg; pek = variant_id + pcs
    const r = get(s.product_id, s.variant_id, s.unit, s.name, s.variant_name && s.variant_name !== 'ikut berat' ? s.variant_name : null)
    r.sold = round3(r.sold + Number(s.qty))
  }
  for (const r of map.values()) r.balance = round3(r.received - r.returned - r.sold)
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name) || (a.variant ?? '').localeCompare(b.variant ?? ''))
}

/** Ringkasan konsainan untuk julat tarikh (dashboard). Toleran: 158 belum run → sifar. */
export async function consignRangeTotals(sb: SB, startIso: string, endIso: string, outletId: string | null): Promise<{ sales: number; payable: number; commission: number; lines: number }> {
  try {
    type Row = { line_total: number | string; consign_payable: number | string | null }
    const rows = await fetchAll<Row>((f, t) => {
      let q = sb.from('pos_sale_items').select('line_total, consign_payable, pos_sales!inner(status, sold_at, outlet_id)').not('consignor_id', 'is', null).eq('pos_sales.status', 'paid').gte('pos_sales.sold_at', startIso).lt('pos_sales.sold_at', endIso).order('id').range(f, t)
      if (outletId) q = q.eq('pos_sales.outlet_id', outletId)
      return q
    })
    const sales = round2(rows.reduce((a, r) => a + Number(r.line_total), 0))
    const payable = round2(rows.reduce((a, r) => a + Number(r.consign_payable ?? 0), 0))
    return { sales, payable, commission: round2(sales - payable), lines: rows.length }
  } catch { return { sales: 0, payable: 0, commission: 0, lines: 0 } }
}
