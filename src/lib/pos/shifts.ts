import type { SupabaseClient } from '@supabase/supabase-js'
import { round2, round3 } from '@/lib/pos/money'
import { POS_DECLARE_METHODS, POS_PAY_LABEL, type PosPayMethod } from '@/lib/pos/types'

// Shift POS = buka kedai / tutup kedai per register (jadual pos_shifts & pos_cash_movements dari migration 155).
//  • Buka: modal tunai (opening float) → satu shift terbuka per register (indeks unik separa).
//  • Semasa buka: jualan register itu dilekatkan shift_id (createSale cari shift terbuka); tunai masuk/keluar direkod.
//  • Tutup: kasyer kira tunai dalam laci → expected = float + jualan tunai + masuk − keluar; variance = dikira − expected;
//    ringkasan dibekukan dalam pos_shifts.summary (laporan Z). Laporan X = ringkasan langsung shift terbuka.
//  • Tutup juga mengisytihar SEMUA jenis bayaran: tunai (dikira) + QR / kad / e-wallet (jumlah sebenar dari app bank /
//    slip settlement) → summary.declared & summary.tenderVariance (diisytihar − rekod sistem). Wajib bagi kaedah yang ada jualan.
// Hasil = jualan status 'paid' sahaja (void/pending dikira berasingan). opened_by/closed_by = id kasyer (null bila admin tanpa PIN).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

const SHIFT_SELECT = '*, pos_registers(code, name), opener:pos_cashiers!opened_by(name), closer:pos_cashiers!closed_by(name)'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PosShiftSummary {
  sales: number; revenue: number; discount: number; voids: number; pending: number; weightKg: number
  byMethod: Partial<Record<PosPayMethod, { count: number; amount: number }>>
  byCashier: { name: string; sales: number; revenue: number }[]
  openingFloat: number
  cashSales: number            // bahagian jualan yang dibayar tunai (bersih baki)
  cashIn: number; cashOut: number
  expectedCash: number         // float + cashSales + cashIn − cashOut
  movements: { id: string; type: 'in' | 'out'; amount: number; reason: string | null; created_at: string; cashier: string | null }[]
  generatedAt: string
  /** Diisi semasa tutup: jumlah diisytihar staf per kaedah (cash = tunai dikira). */
  declared?: Partial<Record<PosPayMethod, number>>
  /** Diisytihar − rekod sistem per kaedah (cash = dikira − dijangka dalam laci). */
  tenderVariance?: Partial<Record<PosPayMethod, number>>
}
export interface PosShiftRow {
  id: string; register_id: string; status: 'open' | 'closed'
  opened_at: string; opened_by: string | null; opening_float: number
  closed_at: string | null; closed_by: string | null
  counted_cash: number | null; expected_cash: number | null; variance: number | null
  summary: PosShiftSummary | null; notes: string | null
  pos_registers?: { code: string; name: string } | null
  opener?: { name: string } | null; closer?: { name: string } | null
}

export class ShiftError extends Error { constructor(message: string, public status = 400) { super(message) } }

const num = (r: PosShiftRow): PosShiftRow => ({ ...r, opening_float: Number(r.opening_float), counted_cash: r.counted_cash == null ? null : Number(r.counted_cash), expected_cash: r.expected_cash == null ? null : Number(r.expected_cash), variance: r.variance == null ? null : Number(r.variance) })

export async function loadOpenShift(sb: SB, registerId: string | null | undefined): Promise<PosShiftRow | null> {
  if (!registerId || !UUID.test(registerId)) return null
  const { data, error } = await sb.from('pos_shifts').select(SHIFT_SELECT).eq('register_id', registerId).eq('status', 'open').maybeSingle()
  if (error || !data) return null
  return num(data as PosShiftRow)
}
export async function loadShift(sb: SB, id: string): Promise<PosShiftRow | null> {
  if (!UUID.test(id)) return null
  const { data, error } = await sb.from('pos_shifts').select(SHIFT_SELECT).eq('id', id).maybeSingle()
  if (error || !data) return null
  return num(data as PosShiftRow)
}
export async function loadLastClosedShift(sb: SB, registerId: string): Promise<PosShiftRow | null> {
  const { data, error } = await sb.from('pos_shifts').select(SHIFT_SELECT).eq('register_id', registerId).eq('status', 'closed').order('closed_at', { ascending: false }).limit(1).maybeSingle()
  if (error || !data) return null
  return num(data as PosShiftRow)
}

/** Ambil semua baris melepasi had 1000 PostgREST (shift bazar sibuk). */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await build(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function buildShiftSummary(sb: SB, shift: PosShiftRow): Promise<PosShiftSummary> {
  type SaleRow = { id: string; status: string; total: number | string; discount_total: number | string; promo_discount: number | string; weight_kg_total: number | string; cashier_id: string | null; pos_cashiers: { name: string } | null }
  type PayRow = { method: PosPayMethod; amount: number | string }
  type MoveRow = { id: string; type: 'in' | 'out'; amount: number | string; reason: string | null; created_at: string; pos_cashiers: { name: string } | null }
  const [sales, pays, moves] = await Promise.all([
    fetchAll<SaleRow>((f, t) => sb.from('pos_sales').select('id, status, total, discount_total, promo_discount, weight_kg_total, cashier_id, pos_cashiers!cashier_id(name)').eq('shift_id', shift.id).order('id').range(f, t)),
    // inner join → tapis ikut shift & status jualan tanpa senarai id panjang dalam URL
    fetchAll<PayRow>((f, t) => sb.from('pos_payments').select('method, amount, pos_sales!inner(shift_id, status)').eq('pos_sales.shift_id', shift.id).eq('pos_sales.status', 'paid').eq('status', 'paid').order('id').range(f, t)),
    fetchAll<MoveRow>((f, t) => sb.from('pos_cash_movements').select('id, type, amount, reason, created_at, pos_cashiers(name)').eq('shift_id', shift.id).order('created_at').range(f, t)),
  ])
  const paid = sales.filter(s => s.status === 'paid')
  const byMethod: PosShiftSummary['byMethod'] = {}
  for (const p of pays) { const cur = byMethod[p.method] ?? { count: 0, amount: 0 }; cur.count += 1; cur.amount = round2(cur.amount + Number(p.amount)); byMethod[p.method] = cur }
  const cashierMap = new Map<string, { name: string; sales: number; revenue: number }>()
  for (const s of paid) { const k = s.cashier_id ?? '-'; const cur = cashierMap.get(k) ?? { name: s.pos_cashiers?.name ?? 'No cashier (admin)', sales: 0, revenue: 0 }; cur.sales += 1; cur.revenue = round2(cur.revenue + Number(s.total)); cashierMap.set(k, cur) }
  const cashSales = round2(byMethod.cash?.amount ?? 0)
  const cashIn = round2(moves.filter(m => m.type === 'in').reduce((a, m) => a + Number(m.amount), 0))
  const cashOut = round2(moves.filter(m => m.type === 'out').reduce((a, m) => a + Number(m.amount), 0))
  return {
    sales: paid.length,
    revenue: round2(paid.reduce((a, s) => a + Number(s.total), 0)),
    discount: round2(paid.reduce((a, s) => a + Number(s.discount_total) + Number(s.promo_discount), 0)),
    voids: sales.filter(s => s.status === 'void').length,
    pending: sales.filter(s => s.status === 'pending').length,
    weightKg: round3(paid.reduce((a, s) => a + Number(s.weight_kg_total), 0)),
    byMethod,
    byCashier: Array.from(cashierMap.values()).sort((a, b) => b.revenue - a.revenue),
    openingFloat: Number(shift.opening_float),
    cashSales, cashIn, cashOut,
    expectedCash: round2(Number(shift.opening_float) + cashSales + cashIn - cashOut),
    movements: moves.map(m => ({ id: m.id, type: m.type, amount: Number(m.amount), reason: m.reason, created_at: m.created_at, cashier: m.pos_cashiers?.name ?? null })),
    generatedAt: new Date().toISOString(),
  }
}

export async function openShift(sb: SB, p: { registerId: string; openingFloat: number; cashierId: string | null; note?: string | null }): Promise<PosShiftRow> {
  if (!UUID.test(p.registerId)) throw new ShiftError('Register is required')
  if (!Number.isFinite(p.openingFloat) || p.openingFloat < 0 || p.openingFloat > 100_000) throw new ShiftError('Opening float is invalid')
  const { data, error } = await sb.from('pos_shifts').insert({ register_id: p.registerId, opening_float: round2(p.openingFloat), opened_by: p.cashierId, notes: p.note?.trim().slice(0, 300) || null }).select('id').single()
  if (error) {
    if (error.code === '23505') throw new ShiftError('This register is already open', 409)
    if (error.code === '23503') throw new ShiftError('Register not found', 404)
    throw new ShiftError(error.message, 500)
  }
  return (await loadShift(sb, data.id))!
}

export async function addCashMovement(sb: SB, shiftId: string, p: { type: 'in' | 'out'; amount: number; reason: string | null; cashierId: string | null }): Promise<void> {
  const shift = await loadShift(sb, shiftId)
  if (!shift) throw new ShiftError('Shift not found', 404)
  if (shift.status !== 'open') throw new ShiftError('Shift is closed', 409)
  if (!Number.isFinite(p.amount) || p.amount <= 0 || p.amount > 100_000) throw new ShiftError('Amount is invalid')
  const { error } = await sb.from('pos_cash_movements').insert({ shift_id: shiftId, type: p.type, amount: round2(p.amount), reason: p.reason?.trim().slice(0, 200) || null, cashier_id: p.cashierId })
  if (error) throw new ShiftError(error.message, 500)
}

/** Tutup shift: bekukan ringkasan (Z), expected vs dikira. Tuntutan atomik status open → closed. */
export async function closeShift(sb: SB, id: string, p: { countedCash: number; cashierId: string | null; note?: string | null; declared?: Partial<Record<PosPayMethod, unknown>> | null }): Promise<PosShiftRow> {
  const shift = await loadShift(sb, id)
  if (!shift) throw new ShiftError('Shift not found', 404)
  if (shift.status !== 'open') throw new ShiftError('Shift is already closed', 409)
  if (!Number.isFinite(p.countedCash) || p.countedCash < 0 || p.countedCash > 1_000_000) throw new ShiftError('Counted cash is invalid')
  const summary = await buildShiftSummary(sb, shift)
  const counted = round2(p.countedCash)
  // Isytihar semua jenis bayaran: wajib bagi kaedah bukan tunai yang ada jualan dalam shift ini
  const declared: Partial<Record<PosPayMethod, number>> = { cash: counted }
  const tenderVariance: Partial<Record<PosPayMethod, number>> = { cash: round2(counted - summary.expectedCash) }
  for (const m of POS_DECLARE_METHODS) {
    const expected = summary.byMethod[m]?.amount ?? 0
    const raw = p.declared?.[m]
    if (raw === undefined || raw === null || raw === '') {
      if (expected > 0) throw new ShiftError(`Enter the ${POS_PAY_LABEL[m]} total (${summary.byMethod[m]?.count ?? 0} sales in this shift)`)
      continue
    }
    const d = Number(raw)
    if (!Number.isFinite(d) || d < 0 || d > 1_000_000) throw new ShiftError(`${POS_PAY_LABEL[m]} total is invalid`)
    declared[m] = round2(d)
    tenderVariance[m] = round2(d - expected)
  }
  summary.declared = declared
  summary.tenderVariance = tenderVariance
  const note = [shift.notes, p.note?.trim().slice(0, 300)].filter(Boolean).join(' · ') || null
  const { data, error } = await sb.from('pos_shifts')
    .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: p.cashierId, counted_cash: counted, expected_cash: summary.expectedCash, variance: round2(counted - summary.expectedCash), summary, notes: note })
    .eq('id', id).eq('status', 'open').select('id')
  if (error) throw new ShiftError(error.message, 500)
  if (!data?.[0]) throw new ShiftError('Shift was closed by someone else', 409)
  return (await loadShift(sb, id))!
}
