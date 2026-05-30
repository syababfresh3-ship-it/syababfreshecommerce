import { requireAdmin } from '@/lib/supabase/require-admin'
import { sendWhatsApp } from '@/lib/murpati'
import { NextResponse } from 'next/server'

// Hantar WA tracking penghantaran ganti produk ke customer.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data: r } = await supabase!
    .from('refunds')
    .select('customer_name, customer_phone, order_number, ganti_qty, ganti_variation, ganti_courier, ganti_tracking_no, ganti_tracking_link')
    .eq('id', id)
    .single()
  if (!r) return NextResponse.json({ error: 'Refund tidak dijumpai.' }, { status: 404 })
  if (!r.customer_phone) return NextResponse.json({ error: 'Tiada no telefon customer.' }, { status: 400 })
  if (!r.ganti_tracking_no && !r.ganti_tracking_link) {
    return NextResponse.json({ error: 'Tiada maklumat tracking ganti.' }, { status: 400 })
  }

  const lines = [
    `Hai ${r.customer_name ?? ''} 🌿`.trim(),
    ``,
    `Produk ganti untuk pesanan *${r.order_number}* sedang dalam penghantaran! 🚚`,
    r.ganti_qty ? `• Qty: ${r.ganti_qty}${r.ganti_variation ? ` (${r.ganti_variation})` : ''}` : '',
    r.ganti_courier ? `• Kurier: ${r.ganti_courier}` : '',
    r.ganti_tracking_no ? `• No. Tracking: *${r.ganti_tracking_no}*` : '',
    r.ganti_tracking_link ? `• Jejak: ${r.ganti_tracking_link}` : '',
    ``,
    `Terima kasih 🙏`,
    `SyababFresh 🌿`,
  ].filter(Boolean)

  await sendWhatsApp(r.customer_phone, lines.join('\n'))
  return NextResponse.json({ ok: true })
}
