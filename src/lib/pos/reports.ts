import type { SupabaseClient } from '@supabase/supabase-js'
import { klDayWindow } from '@/lib/daily-summary'
import { round2, round3 } from '@/lib/pos/money'
import { shiftDateStr } from '@/lib/pos/dates'
import { fetchAll } from '@/lib/pos/shifts'
import { consignRangeTotals } from '@/lib/pos/consign'
import type { PosPayMethod } from '@/lib/pos/types'

// Laporan POS (server): ringkasan satu hari (laporan X di /pos/sales & dashboard admin).
// Hasil = jualan status 'paid'. Void dikira berasingan. Masa ikut Asia/Kuala_Lumpur.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export interface PosDayReport {
  date: string
  registerId: string | null
  sales: number
  revenue: number
  discount: number
  weightKg: number
  voids: number
  pending: number
  byMethod: Partial<Record<PosPayMethod, { count: number; amount: number }>>
  byCashier: { cashierId: string | null; name: string; sales: number; revenue: number }[]
  topItems: { name: string; qty: number; unit: 'pcs' | 'kg'; revenue: number }[]
  cashTendered: number
  cashChange: number
}

const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

export async function buildPosDayReport(sb: SB, date: string, registerId?: string | null): Promise<PosDayReport | null> {
  const { start, end } = klDayWindow(date)
  let q = sb.from('pos_sales')
    .select('id, status, total, discount_total, promo_discount, weight_kg_total, cashier_id, pos_cashiers!cashier_id(name)')
    .gte('sold_at', start).lt('sold_at', end)
  if (registerId) q = q.eq('register_id', registerId)
  const { data: sales, error } = await q
  if (error) {
    if (MISSING_TABLE.has(error.code ?? '')) return null
    throw new Error(error.message)
  }
  type SaleRow = { id: string; status: string; total: number | string; discount_total: number | string; promo_discount: number | string; weight_kg_total: number | string; cashier_id: string | null; pos_cashiers: { name: string } | null }
  const rows = (sales ?? []) as unknown as SaleRow[]
  const paid = rows.filter(r => r.status === 'paid')
  const ids = paid.map(r => r.id)

  const report: PosDayReport = {
    date, registerId: registerId ?? null,
    sales: paid.length,
    revenue: round2(paid.reduce((s, r) => s + Number(r.total), 0)),
    discount: round2(paid.reduce((s, r) => s + Number(r.discount_total) + Number(r.promo_discount), 0)),
    weightKg: round3(paid.reduce((s, r) => s + Number(r.weight_kg_total), 0)),
    voids: rows.filter(r => r.status === 'void').length,
    pending: rows.filter(r => r.status === 'pending').length,
    byMethod: {}, byCashier: [], topItems: [], cashTendered: 0, cashChange: 0,
  }

  const cashierMap = new Map<string, { cashierId: string | null; name: string; sales: number; revenue: number }>()
  for (const r of paid) {
    const key = r.cashier_id ?? '-'
    const cur = cashierMap.get(key) ?? { cashierId: r.cashier_id, name: r.pos_cashiers?.name ?? 'Tiada kasyer', sales: 0, revenue: 0 }
    cur.sales += 1; cur.revenue = round2(cur.revenue + Number(r.total))
    cashierMap.set(key, cur)
  }
  report.byCashier = Array.from(cashierMap.values()).sort((a, b) => b.revenue - a.revenue)

  if (ids.length === 0) return report

  const [{ data: pays }, { data: items }] = await Promise.all([
    sb.from('pos_payments').select('sale_id, method, amount, tendered, change_given, status').in('sale_id', ids).eq('status', 'paid'),
    sb.from('pos_sale_items').select('name, variant_name, qty, unit, line_total').in('sale_id', ids),
  ])
  for (const p of (pays ?? []) as { method: PosPayMethod; amount: number | string; tendered: number | string | null; change_given: number | string | null }[]) {
    const cur = report.byMethod[p.method] ?? { count: 0, amount: 0 }
    cur.count += 1; cur.amount = round2(cur.amount + Number(p.amount))
    report.byMethod[p.method] = cur
    if (p.method === 'cash') {
      report.cashTendered = round2(report.cashTendered + Number(p.tendered ?? p.amount))
      report.cashChange = round2(report.cashChange + Number(p.change_given ?? 0))
    }
  }
  const itemMap = new Map<string, { name: string; qty: number; unit: 'pcs' | 'kg'; revenue: number }>()
  for (const it of (items ?? []) as { name: string; variant_name: string | null; qty: number | string; unit: 'pcs' | 'kg'; line_total: number | string }[]) {
    const name = it.variant_name && it.variant_name !== 'ikut berat' ? `${it.name} ${it.variant_name}` : it.name
    const key = `${name}|${it.unit}`
    const cur = itemMap.get(key) ?? { name, qty: 0, unit: it.unit, revenue: 0 }
    cur.qty = it.unit === 'kg' ? round3(cur.qty + Number(it.qty)) : cur.qty + Number(it.qty)
    cur.revenue = round2(cur.revenue + Number(it.line_total))
    itemMap.set(key, cur)
  }
  report.topItems = Array.from(itemMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  return report
}


// ── Laporan julat tarikh (dashboard jualan admin /admin/pos) ─────────────────────────────────────
// Hasil = jualan 'paid' sahaja. Semua baldi masa ikut Asia/Kuala_Lumpur (UTC+8, tiada DST).
// Item & bayaran ditapis melalui inner join ke pos_sales (elak senarai id panjang dalam URL) dan
// dipaginasi (had 1000 baris PostgREST). Penapis outlet guna pos_sales.outlet_id (migration 157;
// jualan sebelum 157 tiada outlet → hanya muncul bila "semua outlet").

export interface PosRangeReport {
  from: string; to: string; days: number
  totals: { revenue: number; sales: number; avgSale: number; discount: number; voids: number; voidAmount: number; pending: number; itemsPcs: number; weightKg: number }
  prev: { from: string; to: string; revenue: number; sales: number }
  byDay: { date: string; revenue: number; sales: number }[]
  byHour: { hour: number; revenue: number; sales: number }[]
  topItems: { name: string; variant: string | null; unit: 'pcs' | 'kg'; qty: number; revenue: number; lines: number }[]
  byCategory: { name: string; revenue: number; lines: number }[]
  byMethod: { method: PosPayMethod; count: number; amount: number }[]
  byRegister: { registerId: string | null; code: string; name: string; outlet: string | null; sales: number; revenue: number }[]
  byCashier: { name: string; sales: number; revenue: number }[]
  /** Konsainan (migration 158): jualan barang pembekal, jumlah perlu dibayar, komisen kedai. Sifar bila tiada. */
  consign: { sales: number; payable: number; commission: number; lines: number }
}

const RANGE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const klParts = (iso: string) => { const d = new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString(); return { date: d.slice(0, 10), hour: Number(d.slice(11, 13)) } }

export async function buildPosRangeReport(sb: SB, from: string, to: string, opts: { outletId?: string | null } = {}): Promise<PosRangeReport | null> {
  const start = klDayWindow(from).start, end = klDayWindow(to).end
  const dayList: string[] = []
  for (let d = from; d <= to && dayList.length < 400; d = shiftDateStr(d, 1)) dayList.push(d)
  const n = dayList.length
  const prevTo = shiftDateStr(from, -1), prevFrom = shiftDateStr(from, -n)
  const outlet = opts.outletId && RANGE_UUID.test(opts.outletId) ? opts.outletId : null

  type SaleRow = { id: string; status: string; total: number | string; discount_total: number | string; promo_discount: number | string; weight_kg_total: number | string; sold_at: string; register_id: string | null; cashier_id: string | null; pos_cashiers: { name: string } | null }
  type ItemRow = { name: string; variant_name: string | null; qty: number | string; unit: 'pcs' | 'kg'; line_total: number | string; products: { categories: { name: string } | null } | null }
  type PayRow = { method: PosPayMethod; amount: number | string }
  type RegRow = { id: string; code: string; name: string; outlet?: { code: string; name: string } | { code: string; name: string }[] | null }

  let sales: SaleRow[]
  try {
    sales = await fetchAll<SaleRow>((f, t) => {
      let q = sb.from('pos_sales').select('id, status, total, discount_total, promo_discount, weight_kg_total, sold_at, register_id, cashier_id, pos_cashiers!cashier_id(name)').gte('sold_at', start).lt('sold_at', end).order('id').range(f, t)
      if (outlet) q = q.eq('outlet_id', outlet)
      return q
    })
  } catch (e) {
    if (e instanceof Error && /does not exist|Could not find/i.test(e.message)) return null
    throw e
  }

  const [items, pays, prevSales, regsFull, consign] = await Promise.all([
    fetchAll<ItemRow>((f, t) => {
      let q = sb.from('pos_sale_items').select('name, variant_name, qty, unit, line_total, products(categories(name)), pos_sales!inner(status, sold_at, outlet_id)').eq('pos_sales.status', 'paid').gte('pos_sales.sold_at', start).lt('pos_sales.sold_at', end).order('id').range(f, t)
      if (outlet) q = q.eq('pos_sales.outlet_id', outlet)
      return q
    }),
    fetchAll<PayRow>((f, t) => {
      let q = sb.from('pos_payments').select('method, amount, pos_sales!inner(status, sold_at, outlet_id)').eq('status', 'paid').eq('pos_sales.status', 'paid').gte('pos_sales.sold_at', start).lt('pos_sales.sold_at', end).order('id').range(f, t)
      if (outlet) q = q.eq('pos_sales.outlet_id', outlet)
      return q
    }),
    fetchAll<{ total: number | string }>((f, t) => {
      let q = sb.from('pos_sales').select('total').eq('status', 'paid').gte('sold_at', klDayWindow(prevFrom).start).lt('sold_at', klDayWindow(prevTo).end).order('id').range(f, t)
      if (outlet) q = q.eq('outlet_id', outlet)
      return q
    }),
    sb.from('pos_registers').select('id, code, name, outlet:pos_outlets!outlet_id(code, name)'),
    consignRangeTotals(sb, start, end, outlet),
  ])
  const regs = (regsFull.error ? ((await sb.from('pos_registers').select('id, code, name')).data ?? []) : (regsFull.data ?? [])) as RegRow[]
  const regMap = new Map(regs.map(r => [r.id, r]))

  const paid = sales.filter(s => s.status === 'paid')
  const voided = sales.filter(s => s.status === 'void')
  const revenue = round2(paid.reduce((a, s) => a + Number(s.total), 0))

  const dayMap = new Map(dayList.map(d => [d, { date: d, revenue: 0, sales: 0 }]))
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, sales: 0 }))
  const regAgg = new Map<string, { registerId: string | null; code: string; name: string; outlet: string | null; sales: number; revenue: number }>()
  const cashAgg = new Map<string, { name: string; sales: number; revenue: number }>()
  for (const s of paid) {
    const { date, hour } = klParts(s.sold_at)
    const d = dayMap.get(date); if (d) { d.revenue = round2(d.revenue + Number(s.total)); d.sales += 1 }
    const h = hours.at(hour); if (h) { h.revenue = round2(h.revenue + Number(s.total)); h.sales += 1 }
    const rk = s.register_id ?? '-'
    const reg = s.register_id ? regMap.get(s.register_id) : undefined
    const ro = reg?.outlet ? (Array.isArray(reg.outlet) ? reg.outlet[0] : reg.outlet) : null
    const ra = regAgg.get(rk) ?? { registerId: s.register_id, code: reg?.code ?? '—', name: reg?.name ?? 'No register', outlet: ro?.name ?? null, sales: 0, revenue: 0 }
    ra.sales += 1; ra.revenue = round2(ra.revenue + Number(s.total)); regAgg.set(rk, ra)
    const ck = s.cashier_id ?? '-'
    const ca = cashAgg.get(ck) ?? { name: s.pos_cashiers?.name ?? 'No cashier (admin)', sales: 0, revenue: 0 }
    ca.sales += 1; ca.revenue = round2(ca.revenue + Number(s.total)); cashAgg.set(ck, ca)
  }

  const itemAgg = new Map<string, PosRangeReport['topItems'][number]>()
  const catAgg = new Map<string, { name: string; revenue: number; lines: number }>()
  let itemsPcs = 0
  for (const it of items) {
    const variant = it.variant_name && it.variant_name !== 'ikut berat' ? it.variant_name : null
    const k = `${it.name}|${variant ?? ''}|${it.unit}`
    const cur = itemAgg.get(k) ?? { name: it.name, variant, unit: it.unit, qty: 0, revenue: 0, lines: 0 }
    cur.qty = it.unit === 'kg' ? round3(cur.qty + Number(it.qty)) : cur.qty + Number(it.qty)
    cur.revenue = round2(cur.revenue + Number(it.line_total)); cur.lines += 1
    itemAgg.set(k, cur)
    if (it.unit === 'pcs') itemsPcs += Number(it.qty)
    const cn = it.products?.categories?.name ?? 'Other / custom items'
    const cc = catAgg.get(cn) ?? { name: cn, revenue: 0, lines: 0 }
    cc.revenue = round2(cc.revenue + Number(it.line_total)); cc.lines += 1; catAgg.set(cn, cc)
  }
  const methodAgg = new Map<PosPayMethod, { method: PosPayMethod; count: number; amount: number }>()
  for (const p of pays) { const cur = methodAgg.get(p.method) ?? { method: p.method, count: 0, amount: 0 }; cur.count += 1; cur.amount = round2(cur.amount + Number(p.amount)); methodAgg.set(p.method, cur) }

  return {
    from, to, days: n,
    totals: {
      revenue, sales: paid.length, avgSale: paid.length ? round2(revenue / paid.length) : 0,
      discount: round2(paid.reduce((a, s) => a + Number(s.discount_total) + Number(s.promo_discount), 0)),
      voids: voided.length, voidAmount: round2(voided.reduce((a, s) => a + Number(s.total), 0)),
      pending: sales.filter(s => s.status === 'pending').length,
      itemsPcs, weightKg: round3(paid.reduce((a, s) => a + Number(s.weight_kg_total), 0)),
    },
    prev: { from: prevFrom, to: prevTo, revenue: round2(prevSales.reduce((a, s) => a + Number(s.total), 0)), sales: prevSales.length },
    byDay: dayList.map(d => dayMap.get(d)!),
    byHour: hours,
    topItems: Array.from(itemAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 100),
    byCategory: Array.from(catAgg.values()).sort((a, b) => b.revenue - a.revenue),
    byMethod: Array.from(methodAgg.values()).sort((a, b) => b.amount - a.amount),
    byRegister: Array.from(regAgg.values()).sort((a, b) => b.revenue - a.revenue),
    byCashier: Array.from(cashAgg.values()).sort((a, b) => b.revenue - a.revenue),
    consign,
  }
}
