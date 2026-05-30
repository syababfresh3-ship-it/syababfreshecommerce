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
    .select('jumlah_refund, status, payment_method, supplier_code, created_at')
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

  return NextResponse.json({
    totalCount: rows.length,
    totalAmount: Math.round(sum(rows) * 100) / 100,
    pendingCount: rows.filter(r => r.status !== 'selesai').length,
    byStatus: tally('status'),
    byPaymentMethod: tally('payment_method'),
    bySupplier: tally('supplier_code'),
    byMonth,
  })
}
