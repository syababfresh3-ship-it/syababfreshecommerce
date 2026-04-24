import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      order_number, status, payment_status, payment_method,
      subtotal, delivery_fee, discount, points_discount, total,
      delivery_address, notes, created_at,
      profiles(full_name, phone, email)
    `)
    .order('created_at', { ascending: false })

  if (!orders) return NextResponse.json({ error: 'No data' }, { status: 500 })

  const headers = [
    'No. Pesanan', 'Tarikh', 'Nama', 'Telefon', 'Email',
    'Status', 'Bayaran', 'Kaedah Bayaran',
    'Subtotal', 'Penghantaran', 'Diskaun', 'Diskaun Mata', 'Jumlah',
    'Alamat', 'Nota',
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
      'Content-Disposition': `attachment; filename="orders-${date}.csv"`,
    },
  })
}
