import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Export semua refund (ikut filter status/tarikh) sebagai CSV.
export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { searchParams } = new URL(request.url)
  const status   = searchParams.get('status') || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo   = searchParams.get('dateTo') || ''

  let query = supabase!
    .from('refunds')
    .select('created_at, order_number, customer_name, customer_phone, payment_method, jumlah_refund, supplier_code, supplier_claim, status, pic_name, reason')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (status) query = query.eq('status', status)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) {
    const end = new Date(dateTo); end.setHours(23, 59, 59, 999)
    query = query.lte('created_at', end.toISOString())
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = ['Tarikh', 'Order', 'Customer', 'Telefon', 'Cara Bayar', 'Jumlah (RM)', 'Supplier', 'Tuntutan Supplier', 'Status', 'PIC', 'Sebab']
  const lines = [headers.join(',')]
  for (const r of data ?? []) {
    lines.push([
      String(r.created_at).slice(0, 10),
      r.order_number, r.customer_name, r.customer_phone,
      r.payment_method, Number(r.jumlah_refund || 0).toFixed(2),
      r.supplier_code, r.supplier_claim ?? '',
      r.status, r.pic_name, r.reason,
    ].map(csvCell).join(','))
  }

  const csv = '﻿' + lines.join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="refunds-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
