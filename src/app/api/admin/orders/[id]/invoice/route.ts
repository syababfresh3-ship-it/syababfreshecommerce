export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { requireAdmin } from '@/lib/supabase/require-admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { NextResponse } from 'next/server'
import { sendCustomerInvoiceEmail } from '@/lib/zeptomail'
import { buildInvoiceElement, type InvoiceData } from '@/app/api/admin/resellers/invoice/[orderId]/invoice-pdf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

// Muat order customer + jamin satu order_invoices, bina data invois.
async function loadInvoice(supabase: SB, orderId: string) {
  const { data: o } = await supabase
    .from('orders')
    .select('id, order_number, user_id, delivery_address, subtotal, delivery_fee, discount, points_discount, total, payment_status, payment_method, status, order_items(product_name, unit_price, quantity)')
    .eq('id', orderId)
    .single()
  if (!o) return { error: 'Order tidak dijumpai', status: 404 as const }

  const { data: profile } = await supabase
    .from('profiles').select('full_name, phone, email').eq('id', o.user_id).maybeSingle()

  // Jamin satu invois per order (jana no. invois jika belum)
  const paid = o.payment_status === 'paid' ||
    (['cod', 'bank_transfer'].includes(o.payment_method) && o.status === 'delivered')

  let { data: inv } = await supabase.from('order_invoices').select('*').eq('order_id', orderId).maybeSingle()
  if (!inv) {
    const { data: num } = await supabase.rpc('generate_order_invoice_number')
    const { data: created, error } = await supabase.from('order_invoices')
      .insert({ order_id: orderId, invoice_number: num, total: o.total, status: paid ? 'paid' : 'issued' })
      .select('*').single()
    if (error || !created) return { error: error?.message ?? 'Gagal cipta invois', status: 500 as const }
    inv = created
  }

  const items = (o.order_items ?? []).map((i: { product_name: string; quantity: number; unit_price: number }) => ({
    product_name: i.product_name, variant_name: null, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
  }))

  const data: InvoiceData = {
    invoiceNumber: inv.invoice_number,
    issuedAt: inv.issued_at,
    orderNumber: o.order_number,
    resellerName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    email: profile?.email ?? null,
    address: o.delivery_address ?? null,
    items,
    deliveryFee: Number(o.delivery_fee || 0),
    discount: Number(o.discount || 0) + Number(o.points_discount || 0),
    total: Number(o.total || 0),
    paid,
  }
  return { data, email: (profile?.email ?? null) as string | null, name: (profile?.full_name ?? null) as string | null }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const res = await loadInvoice(supabase!, id)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  const pdf = await renderToBuffer(buildInvoiceElement(res.data))
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${res.data.invoiceNumber}.pdf"`,
    },
  })
}

// POST → hantar PDF sebagai attachment ke email customer
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const res = await loadInvoice(supabase!, id)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  if (!res.email) return NextResponse.json({ error: 'Customer tiada email' }, { status: 400 })

  const pdf = await renderToBuffer(buildInvoiceElement(res.data))
  const ok = await sendCustomerInvoiceEmail({
    to: res.email, toName: res.name,
    invoiceNumber: res.data.invoiceNumber, total: res.data.total,
    pdfBase64: Buffer.from(pdf).toString('base64'),
  })
  if (!ok) return NextResponse.json({ error: 'Gagal hantar email' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
