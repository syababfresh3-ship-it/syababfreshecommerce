import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { quoteForOrders, QuoteFlowError, type OrderInput } from '@/lib/lalamove-flow'

// POST /api/lalamove/quote — PREVIEW harga sahaja.
// Body: { serviceType?, orders: [{ id, name, phone, address, remarks? }] }
// Pulang: { quotationId, senderStopId, total, currency, recipients, flagged }
//
// Quotation di sini hanya untuk papar harga. Order sebenar di /book akan quote
// SEMULA segar (quotation lama tamat tempoh masa staf baca modal).
export async function POST(request: Request) {
  const { forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { serviceType, orders } = (await request.json()) as { serviceType?: string; orders: OrderInput[] }

  try {
    const result = await quoteForOrders(orders, serviceType ?? 'MOTORCYCLE')
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof QuoteFlowError) {
      return NextResponse.json({ error: err.message, flagged: err.flagged }, { status: err.status })
    }
    console.error('[lalamove/quote]', err?.message, err?.body)
    return NextResponse.json({ error: err?.message ?? 'Quotation gagal', detail: err?.body }, { status: 502 })
  }
}
