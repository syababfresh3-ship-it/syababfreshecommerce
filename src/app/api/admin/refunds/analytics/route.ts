import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// Agregat ringkas untuk dashboard analytics refund.
export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo   = searchParams.get('dateTo') || ''

  let query = supabase!
    .from('refunds')
    .select('jumlah_refund, status, payment_method, supplier_code, created_at, order_id, order_number')
    .order('created_at', { ascending: false })
    .limit(2000)

  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) {
    const end = new Date(dateTo); end.setHours(23, 59, 59, 999)
    query = query.lte('created_at', end.toISOString())
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const sum = (arr: typeof rows) => arr.reduce((s, r) => s + Number(r.jumlah_refund || 0), 0)

  const tally = (key: 'status' | 'payment_method' | 'supplier_code') => {
    const m: Record<string, { count: number; amount: number }> = {}
    for (const r of rows) {
      const k = (r[key] as string) || '-'
      if (!m[k]) m[k] = { count: 0, amount: 0 }
      m[k].count += 1
      m[k].amount += Number(r.jumlah_refund || 0)
    }
    return m
  }

  // By month (YYYY-MM)
  const byMonth: Record<string, { count: number; amount: number }> = {}
  for (const r of rows) {
    const k = String(r.created_at).slice(0, 7)
    if (!byMonth[k]) byMonth[k] = { count: 0, amount: 0 }
    byMonth[k].count += 1
    byMonth[k].amount += Number(r.jumlah_refund || 0)
  }

  // By item — refunds tak simpan produk, jadi kita ikut order yang dirujuk.
  // SYB- = storefront (order_items), LP- = landing page (lp_guest_orders.items).
  const sybIds = [...new Set(rows.filter(r => String(r.order_number || '').startsWith('SYB')).map(r => r.order_id).filter(Boolean))]
  const lpIds  = [...new Set(rows.filter(r => String(r.order_number || '').startsWith('LP')).map(r => r.order_id).filter(Boolean))]
  const productsByOrder: Record<string, string[]> = {}

  if (sybIds.length) {
    const { data: oi } = await supabase!.from('order_items').select('order_id, product_name').in('order_id', sybIds)
    for (const i of oi ?? []) (productsByOrder[i.order_id] ??= []).push(i.product_name)
  }
  if (lpIds.length) {
    const { data: lo } = await supabase!.from('lp_guest_orders').select('id, items, product_name').in('id', lpIds)
    for (const o of lo ?? []) {
      const items = Array.isArray(o.items) && o.items.length ? o.items.map((i: any) => i.product_name) : [o.product_name]
      productsByOrder[o.id] = items.filter(Boolean)
    }
  }

  // Satu refund boleh sentuh order berbilang item → kira tiap produk berbeza sekali
  // (count per-refund; amount diletak penuh pada tiap produk order itu).
  const byItem: Record<string, { count: number; amount: number }> = {}
  for (const r of rows) {
    const names = [...new Set((productsByOrder[r.order_id] ?? []).filter(Boolean))]
    const keys = names.length ? names : ['-']
    for (const k of keys) {
      if (!byItem[k]) byItem[k] = { count: 0, amount: 0 }
      byItem[k].count += 1
      byItem[k].amount += Number(r.jumlah_refund || 0)
    }
  }

  return NextResponse.json({
    totalCount: rows.length,
    totalAmount: Math.round(sum(rows) * 100) / 100,
    pendingCount: rows.filter(r => r.status !== 'selesai').length,
    byStatus: tally('status'),
    byPaymentMethod: tally('payment_method'),
    bySupplier: tally('supplier_code'),
    byItem,
    byMonth,
  })
}
