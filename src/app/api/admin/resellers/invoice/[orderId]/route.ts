export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/supabase/require-admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { NextResponse } from 'next/server'
import { sendResellerInvoiceEmail } from '@/lib/zeptomail'
import { buildInvoiceElement, type InvoiceData } from './invoice-pdf'

// Muat order borong + jamin satu reseller_invoices, bina data invois.
async function loadInvoice(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdmin>>['supabase']>,
  orderId: string,
) {
  const { data: o } = await supabase
    .from('lp_guest_orders')
    .select('id, order_number, name, phone, email, address, items, product_name, variant_name, quantity, unit_price, delivery_fee, discount, total, payment_status, reseller_id')
    .eq('id', orderId)
    .single()
  if (!o) return { error: 'Order tidak dijumpai', status: 404 as const }
  if (!o.reseller_id) return { error: 'Bukan order reseller', status: 400 as const }

  // Jamin satu invois per order (jana no. invois jika belum)
  let { data: inv } = await supabase.from('reseller_invoices').select('*').eq('order_id', orderId).maybeSingle()
  if (!inv) {
    const { data: num } = await supabase.rpc('generate_invoice_number')
    const { data: created, error } = await supabase.from('reseller_invoices')
      .insert({ order_id: orderId, reseller_id: o.reseller_id, invoice_number: num, total: o.total, status: o.payment_status === 'paid' ? 'paid' : 'issued' })
      .select('*').single()
    if (error || !created) return { error: error?.message ?? 'Gagal cipta invois', status: 500 as const }
    inv = created
  }

  const items = (Array.isArray(o.items) && o.items.length > 0
    ? o.items
    : [{ product_name: o.product_name, variant_name: o.variant_name, quantity: o.quantity, unit_price: o.unit_price }]
  ).map((i: any) => ({ product_name: i.product_name, variant_name: i.variant_name ?? null, quantity: Number(i.quantity), unit_price: Number(i.unit_price) }))

  const data: InvoiceData = {
    invoiceNumber: inv.invoice_number,
    issuedAt: inv.issued_at,
    orderNumber: o.order_number,
    resellerName: o.name, phone: o.phone, email: o.email, address: o.address,
    items,
    deliveryFee: Number(o.delivery_fee || 0),
    discount: Number(o.discount || 0),
    total: Number(o.total || 0),
    paid: o.payment_status === 'paid',
  }
  return { data, email: o.email as string | null, name: o.name as string | null }
}

export async function GET(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const res = await loadInvoice(supabase!, orderId)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  const pdf = await renderToBuffer(buildInvoiceElement(res.data))
  return new Response(pdf as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${res.data.invoiceNumber}.pdf"`,
    },
  })
}

// POST ?action=email → hantar PDF sebagai attachment ke email reseller
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const res = await loadInvoice(supabase!, orderId)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  if (!res.email) return NextResponse.json({ error: 'Reseller tiada email' }, { status: 400 })

  const pdf = await renderToBuffer(buildInvoiceElement(res.data))
  const ok = await sendResellerInvoiceEmail({
    to: res.email, toName: res.name,
    invoiceNumber: res.data.invoiceNumber, total: res.data.total,
    pdfBase64: Buffer.from(pdf).toString('base64'),
  })
  if (!ok) return NextResponse.json({ error: 'Gagal hantar email' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
