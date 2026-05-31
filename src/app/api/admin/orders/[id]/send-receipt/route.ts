import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/murpati'

// Admin action: WhatsApp the official receipt link to the customer. Works for
// both storefront (orders) and LP guest (lp_guest_orders) orders — resolved by id.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const settledBy = (payment_status: string | null, payment_method: string | null, status: string | null) =>
    payment_status === 'paid' || (['cod', 'bank_transfer'].includes(payment_method ?? '') && status === 'delivered')

  let phone: string | null = null
  let name = 'Pelanggan'
  let orderNumber = ''
  let settled = false

  const { data: ord } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, payment_method, user_id')
    .eq('id', id)
    .maybeSingle()

  if (ord) {
    settled = settledBy(ord.payment_status, ord.payment_method, ord.status)
    orderNumber = ord.order_number
    const { data: p } = ord.user_id
      ? await supabase.from('profiles').select('full_name, phone').eq('id', ord.user_id).maybeSingle()
      : { data: null }
    phone = (p as any)?.phone ?? null
    name = (p as any)?.full_name ?? 'Pelanggan'
  } else {
    const { data: lp } = await supabase
      .from('lp_guest_orders')
      .select('id, order_number, name, phone, status, payment_status, payment_method')
      .eq('id', id)
      .maybeSingle()
    if (!lp) return NextResponse.json({ error: 'Order tidak dijumpai' }, { status: 404 })
    settled = settledBy(lp.payment_status, lp.payment_method, lp.status)
    orderNumber = lp.order_number
    phone = lp.phone
    name = lp.name ?? 'Pelanggan'
  }

  if (!settled) return NextResponse.json({ error: 'Order belum dibayar — resit belum tersedia' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'Tiada nombor telefon customer' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shop.syababfresh.my'
  const msg = [
    `Assalamualaikum *${name}* 🌿`,
    ``,
    `Berikut resit rasmi untuk pesanan *${orderNumber}*:`,
    `📄 ${appUrl}/resit/${id}`,
    ``,
    `Terima kasih kerana membeli dengan SyababFresh! 🍓`,
  ].join('\n')

  const result = await sendWhatsApp(phone, msg) as any
  if (result?.success === false || result?.error) {
    return NextResponse.json({ error: 'Gagal hantar WhatsApp. Cuba lagi.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, skipped: !!result?.skipped })
}
