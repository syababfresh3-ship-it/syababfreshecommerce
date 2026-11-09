import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { klDateStr, klDayWindow, isValidYmd } from '@/lib/daily-summary'
import { buildPosDayReport } from '@/lib/pos/reports'

// Jualan POS untuk admin: ?from=YYYY-MM-DD&to=YYYY-MM-DD (lalai hari ini) &register= &cashier= &status= &format=csv
// Juga pulangkan laporan hari (bila from===to) untuk dashboard.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sp = new URL(request.url).searchParams
  const today = klDateStr(new Date())
  const from = isValidYmd(sp.get('from')) ? sp.get('from')! : today
  const to = isValidYmd(sp.get('to')) ? sp.get('to')! : from
  const { start } = klDayWindow(from)
  const { end } = klDayWindow(to)

  let q = supabase!.from('pos_sales')
    .select('id, receipt_no, local_ref, status, subtotal, discount_total, promo_code, promo_discount, rounding_adj, total, paid_total, weight_kg_total, sold_at, customer_name, customer_phone, offline, void_reason, stock_notes, public_token, register_id, cashier_id, pos_cashiers!cashier_id(name), pos_registers(code), pos_payments(method, amount, status), pos_sale_items(name, variant_name, qty, unit, unit_price, catalog_price, line_total)')
    .gte('sold_at', start).lt('sold_at', end)
    .order('sold_at', { ascending: false })
    .limit(2000)
  if (sp.get('register')) q = q.eq('register_id', sp.get('register')!)
  if (sp.get('cashier')) q = q.eq('cashier_id', sp.get('cashier')!)
  if (sp.get('status')) q = q.eq('status', sp.get('status')!)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message, sales: [] }, { status: error.code === '42P01' || error.code === 'PGRST205' ? 503 : 500 })

  type Sale = { receipt_no: string | null; local_ref: string | null; status: string; subtotal: number; discount_total: number; promo_code: string | null; promo_discount: number; rounding_adj: number; total: number; weight_kg_total: number; sold_at: string; customer_name: string | null; customer_phone: string | null; offline: boolean; void_reason: string | null; pos_cashiers: { name: string } | null; pos_registers: { code: string } | null; pos_payments: { method: string; amount: number; status: string }[] | null }
  if (sp.get('format') === 'csv') {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['receipt_no', 'local_ref', 'status', 'sold_at_kl', 'register', 'cashier', 'customer_name', 'customer_phone', 'subtotal', 'discount', 'promo_code', 'promo_discount', 'rounding', 'total', 'weight_kg', 'payments', 'offline', 'void_reason']
    const rows = ((data ?? []) as unknown as Sale[]).map(s => [
      s.receipt_no, s.local_ref, s.status,
      new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(s.sold_at)),
      s.pos_registers?.code, s.pos_cashiers?.name, s.customer_name, s.customer_phone,
      Number(s.subtotal).toFixed(2), Number(s.discount_total).toFixed(2), s.promo_code, Number(s.promo_discount).toFixed(2), Number(s.rounding_adj).toFixed(2), Number(s.total).toFixed(2), Number(s.weight_kg_total).toFixed(3),
      (s.pos_payments ?? []).filter(p => p.status === 'paid').map(p => `${p.method}:${Number(p.amount).toFixed(2)}`).join(' | '),
      s.offline ? 'yes' : '', s.void_reason,
    ].map(esc).join(','))
    const csv = [head.join(','), ...rows].join('\r\n')
    return new Response(`﻿${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="pos-sales-${from}_${to}.csv"` } })
  }

  const report = from === to ? await buildPosDayReport(supabase!, from, sp.get('register')).catch(() => null) : null
  return NextResponse.json({ from, to, sales: data ?? [], report })
}
