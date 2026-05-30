import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/murpati'
import { getWaTemplates, buildStatusMessage } from '@/lib/wa-templates'

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { orderId, status, trackingUrl } = await request.json()
  if (!orderId || !status) return NextResponse.json({ error: 'orderId and status required' }, { status: 400 })

  const { data: order } = await supabase!
    .from('lp_guest_orders')
    .select('order_number, name, phone')
    .eq('id', orderId)
    .single()

  if (!order?.phone) return NextResponse.json({ skipped: true, reason: 'no phone' })

  const templates = await getWaTemplates()
  const message = buildStatusMessage(templates, status, {
    name: order.name,
    order_number: order.order_number,
    tracking_url: trackingUrl,
  })
  if (!message) return NextResponse.json({ skipped: true, reason: 'no template for status' })

  sendWhatsApp(order.phone, message).catch(() => {})
  return NextResponse.json({ ok: true })
}
