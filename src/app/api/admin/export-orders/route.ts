import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const url = req.nextUrl
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10))
  const PAGE_SIZE = 500

  let query = supabase!
    .from('orders')
    .select(`
      order_number, status, payment_status, payment_method,
      subtotal, delivery_fee, discount, points_discount, total,
      delivery_address, delivery_slot, notes, created_at,
      profiles(full_name, phone, email)
    `)
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data: orders } = await query

  if (!orders) return NextResponse.json({ error: 'No data' }, { status: 500 })

  const headers = [
    'No. Pesanan', 'Tarikh', 'Nama', 'Telefon', 'Email',
    'Status', 'Bayaran', 'Kaedah Bayaran',
    'Subtotal', 'Penghantaran', 'Diskaun', 'Diskaun Mata', 'Jumlah',
    'Slot Penghantaran', 'Alamat', 'Nota',
  ]

  const rows = orders.map((o: any) => [
    o.order_number,
    new Date(o.created_at).toLocaleString('ms-MY'),
    o.profiles?.full_name ?? '',
    o.profiles?.phone ?? '',
    o.profiles?.email ?? '',
    o.status,
    o.payment_status,
    o.payment_method,
    Number(o.subtotal).toFixed(2),
    Number(o.delivery_fee).toFixed(2),
    Number(o.discount).toFixed(2),
    Number(o.points_discount).toFixed(2),
    Number(o.total).toFixed(2),
    o.delivery_slot ?? '',
    (o.delivery_address ?? '').replace(/\n/g, ' '),
    o.notes ?? '',
  ])

  const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n')

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${date}-p${page + 1}.csv"`,
    },
  })
}
