import { NextRequest, NextResponse } from 'next/server'
import { sendOrderConfirmationEmail, sendPaymentConfirmedEmail, sendDeliveryStatusEmail } from '@/lib/zeptomail'

// Temporary test endpoint — remove after testing
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const to = req.nextUrl.searchParams.get('to')
  if (!to) return NextResponse.json({ error: 'to= required' }, { status: 400 })

  const type = req.nextUrl.searchParams.get('type') ?? 'order'

  const mockItems = [
    { name: 'Musang King D197', quantity: 2, unit_price: 35.00, variant_name: '1kg' },
    { name: 'Strawberry Cameron', quantity: 1, unit_price: 18.50, variant_name: null },
  ]

  try {
    if (type === 'order') {
      await sendOrderConfirmationEmail({
        to,
        customerName: 'Ahmad Test',
        orderNumber: 'SF-TEST-001',
        items: mockItems,
        total: 88.50,
        deliveryAddress: 'No 12, Jalan Mawar 3, Taman Bunga, 47810 Petaling Jaya, Selangor',
        deliverySlot: '2pm - 6pm',
        paymentMethod: 'bank_transfer',
        notes: 'Sila letak depan pintu',
      })
    } else if (type === 'payment') {
      await sendPaymentConfirmedEmail({
        to,
        customerName: 'Ahmad Test',
        orderNumber: 'SF-TEST-001',
        items: mockItems,
        total: 88.50,
        deliveryAddress: 'No 12, Jalan Mawar 3, Taman Bunga, 47810 Petaling Jaya, Selangor',
        deliverySlot: '2pm - 6pm',
        notes: null,
      })
    } else if (type === 'delivering') {
      await sendDeliveryStatusEmail({
        to,
        customerName: 'Ahmad Test',
        orderNumber: 'SF-TEST-001',
        status: 'delivering',
        orderId: 'test-order-id',
      })
    } else if (type === 'delivered') {
      await sendDeliveryStatusEmail({
        to,
        customerName: 'Ahmad Test',
        orderNumber: 'SF-TEST-001',
        status: 'delivered',
        orderId: 'test-order-id',
      })
    }

    return NextResponse.json({ ok: true, type, to })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
