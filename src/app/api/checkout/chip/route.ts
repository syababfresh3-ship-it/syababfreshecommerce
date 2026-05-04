import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CHIP_API_URL = 'https://gate.chip-in.asia/api/v1'

function getAppUrl() {
  // Explicit env var takes priority
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit && !explicit.includes('localhost')) return explicit
  // Fallback to Vercel deployment URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  // Local dev fallback
  return explicit ?? 'http://localhost:3006'
}

export async function POST(req: NextRequest) {
  if (!process.env.CHIP_SECRET_KEY || !process.env.CHIP_BRAND_ID) {
    console.error('[chip] Missing CHIP_SECRET_KEY or CHIP_BRAND_ID')
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
      .select('id, order_number, total, delivery_fee, order_items(product_name, unit_price, quantity)')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
  ])

  if (!orderRes.data) {
    console.error('[chip] Order not found:', orderId)
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const order = orderRes.data
  const appUrl = getAppUrl()

  // Build product line items
  const products: { name: string; price: number; quantity: number }[] = (order.order_items as any[]).map((item) => ({
    name: item.product_name,
    price: Math.round(Number(item.unit_price) * 100), // Chip expects cents
    quantity: item.quantity,
  }))

  // Add delivery fee as a line item if applicable
  const deliveryFee = Number(order.delivery_fee ?? 0)
  if (deliveryFee > 0) {
    products.push({
      name: 'Kos Penghantaran',
      price: Math.round(deliveryFee * 100),
      quantity: 1,
    })
  }

  const body = {
    client: {
      email: user.email!,
      ...(profileRes.data?.full_name ? { full_name: profileRes.data.full_name } : {}),
    },
    purchase: {
      currency: 'MYR',
      products,
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

  console.log('[chip] Creating purchase for order', order.order_number, 'appUrl:', appUrl)

  const chipRes = await fetch(`${CHIP_API_URL}/purchases/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!chipRes.ok) {
    const errBody = await chipRes.text().catch(() => '(no body)')
    console.error('[chip] API error', chipRes.status, errBody)
    return NextResponse.json(
      { error: 'Payment gateway error', detail: chipRes.status },
      { status: 502 }
    )
  }

  const chipData = await chipRes.json()

  if (!chipData.checkout_url) {
    console.error('[chip] No checkout_url in response:', JSON.stringify(chipData))
    return NextResponse.json({ error: 'No checkout URL from gateway' }, { status: 502 })
  }

  return NextResponse.json({ checkoutUrl: chipData.checkout_url })
}
