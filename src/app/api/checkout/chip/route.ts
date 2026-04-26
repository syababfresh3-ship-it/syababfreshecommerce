import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

export async function POST(req: NextRequest) {
  if (!process.env.CHIP_SECRET_KEY || !process.env.CHIP_BRAND_ID || !process.env.NEXT_PUBLIC_APP_URL) {
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const [orderRes, profileRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, total, order_items(product_name, unit_price, quantity)')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
  ])

  if (!orderRes.data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const order = orderRes.data
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const body = {
    client: {
      email: user.email!,
      full_name: profileRes.data?.full_name ?? undefined,
    },
    purchase: {
      currency: 'MYR',
      products: (order.order_items as any[]).map((item) => ({
        name: item.product_name,
        price: Math.round(Number(item.unit_price) * 100),
        quantity: item.quantity,
      })),
      notes: order.order_number,
    },
    brand_id: process.env.CHIP_BRAND_ID!,
    reference: order.id,
    success_redirect: `${appUrl}/orders/${order.id}?new=1`,
    failure_redirect: `${appUrl}/checkout?failed=1`,
    cancel_redirect: `${appUrl}/checkout`,
    success_callback: `${appUrl}/api/webhook/chip`,
    send_receipt: false,
  }

  const chipRes = await fetch(`${CHIP_API_URL}/purchases/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!chipRes.ok) {
    return NextResponse.json({ error: 'Payment gateway error' }, { status: 502 })
  }

  const chipData = await chipRes.json()
  return NextResponse.json({ checkoutUrl: chipData.checkout_url })
}
