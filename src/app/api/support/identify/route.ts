export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/phone'
import { issueSupportToken } from '@/lib/support/token'

// Sahkan order (no order + telefon) → buka/sambung aduan → pulang token + konteks.
export async function POST(req: Request) {
  const { orderNumber, phone }: { orderNumber?: string; phone?: string } = await req.json().catch(() => ({}))
  const on = (orderNumber ?? '').trim()
  const phoneNorm = normalizePhone(phone)
  if (!on || !phoneNorm) {
    return NextResponse.json({ error: 'Sila masukkan no order dan telefon.' }, { status: 400 })
  }

  const admin = createAdminClient()

  let kind: 'store' | 'lp' | null = null
  let orderId = ''
  let status = ''
  let name: string | null = null
  let email: string | null = null

  // Cuba storefront dahulu (telefon via profiles)
  const { data: order } = await admin
    .from('orders')
    .select('id, status, user_id')
    .eq('order_number', on)
    .maybeSingle()
  if (order) {
    const { data: prof } = order.user_id
      ? await admin.from('profiles').select('full_name, phone, email').eq('id', order.user_id).maybeSingle()
      : { data: null }
    if (prof && normalizePhone(prof.phone) === phoneNorm) {
      kind = 'store'; orderId = order.id; status = order.status
      name = prof.full_name ?? null; email = prof.email ?? null
    }
  }

  // Kalau bukan storefront, cuba LP (telefon pada baris)
  if (!kind) {
    const { data: lp } = await admin
      .from('lp_guest_orders')
      .select('id, status, name, phone, email')
      .eq('order_number', on)
      .maybeSingle()
    if (lp && normalizePhone(lp.phone) === phoneNorm) {
      kind = 'lp'; orderId = lp.id; status = lp.status
      name = lp.name ?? null; email = lp.email ?? null
    }
  }

  if (!kind) {
    return NextResponse.json({ error: 'Order tidak dijumpai atau telefon tak padan.' }, { status: 404 })
  }

  // Sambung aduan terbuka, atau buka baru
  const { data: existing } = await admin
    .from('support_complaints')
    .select('id')
    .eq('order_id', orderId)
    .in('status', ['open', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let complaintId = existing?.id as string | undefined
  if (!complaintId) {
    const { data: created, error } = await admin
      .from('support_complaints')
      .insert({
        order_kind: kind, order_id: orderId, order_number: on,
        customer_name: name, customer_phone: phoneNorm, customer_email: email,
        status: 'open',
      })
      .select('id')
      .single()
    if (error || !created) return NextResponse.json({ error: 'Gagal buka aduan.' }, { status: 500 })
    complaintId = created.id
  }
  if (!complaintId) return NextResponse.json({ error: 'Gagal buka aduan.' }, { status: 500 })

  // Muat semula mesej lepas (kalau sambung)
  const { data: msgs } = await admin
    .from('support_messages')
    .select('role, content')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    token: issueSupportToken(complaintId),
    order: { number: on, status, name },
    messages: msgs ?? [],
  })
}
