import { requireAdmin } from '@/lib/supabase/require-admin'
import { sendWhatsApp } from '@/lib/murpati'
import { PAYMENT_LABELS, STATUS_LABELS } from '@/lib/refund-calc'
import type { RefundPaymentMethod, RefundStatus } from '@/lib/refund-calc'
import { NextResponse } from 'next/server'

// Hantar WA makluman refund ke customer.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data: r } = await supabase!
    .from('refunds')
    .select('customer_name, customer_phone, order_number, jumlah_refund, payment_method, status, baucar_kod')
    .eq('id', id)
    .single()
  if (!r) return NextResponse.json({ error: 'Refund tidak dijumpai.' }, { status: 404 })
  if (!r.customer_phone) return NextResponse.json({ error: 'Tiada no telefon customer.' }, { status: 400 })

  const lines = [
    `Hai ${r.customer_name ?? ''} 🌿`.trim(),
    ``,
    `Maklumat refund pesanan *${r.order_number}*:`,
    `• Jumlah: *RM${Number(r.jumlah_refund).toFixed(2)}*`,
    `• Cara: ${PAYMENT_LABELS[r.payment_method as RefundPaymentMethod]}`,
    `• Status: ${STATUS_LABELS[r.status as RefundStatus]}`,
  ]
  if (r.payment_method === 'baucar' && r.baucar_kod) {
    lines.push(
      ``,
      `🎁 *Kod Baucar Anda: ${r.baucar_kod}*`,
      `Nilai RM${Number(r.jumlah_refund).toFixed(2)} — taip kod ini di checkout untuk potongan.`,
      `(Sah 90 hari, 1 kali guna)`,
    )
  }
  lines.push('', 'Terima kasih atas kesabaran anda 🙏', 'SyababFresh 🌿')

  await sendWhatsApp(r.customer_phone, lines.join('\n'))
  return NextResponse.json({ ok: true })
}
