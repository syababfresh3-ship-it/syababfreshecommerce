import type { SupabaseClient } from '@supabase/supabase-js'
import { klDayWindow } from '@/lib/daily-summary'
import { round2, round3 } from '@/lib/pos/money'
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
