export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/phone'
import { issueSupportToken } from '@/lib/support/token'
import { verifyOtp } from '@/lib/support/otp'
import type { SupabaseClient } from '@supabase/supabase-js'

interface Cand {
  kind: 'store' | 'lp'
  orderId: string
  orderNumber: string
  status: string
  createdAt: string
  name: string | null
  email: string | null
}

// Sahkan pelanggan via TELEFON (no order optional). Kalau telefon padan >1 order,
// pulang senarai untuk pilih (latest dahulu). Kalau 1, terus buka/sambung aduan.
export async function POST(req: Request) {
  const { orderNumber, phone, otp }: { orderNumber?: string; phone?: string; otp?: string } = await req.json().catch(() => ({}))
  const on = (orderNumber ?? '').trim()
  const phoneNorm = normalizePhone(phone)
  if (!phoneNorm) return NextResponse.json({ error: 'Sila masukkan no telefon.' }, { status: 400 })

  const admin = createAdminClient()

  // Wajib sahkan OTP dulu — pastikan pemanggil memang tuan nombor ini
  // (tutup enumerasi telefon + impersonation).
  const otpOk = await verifyOtp(admin, phoneNorm, (otp ?? '').trim())
  if (!otpOk) {
    return NextResponse.json({ error: 'Kod OTP salah atau sudah tamat tempoh. Sila minta kod baru.' }, { status: 401 })
  }

  const cands = await findCandidates(admin, phoneNorm, on)

  if (cands.length === 0) {
    return NextResponse.json({ error: 'Tiada order dijumpai untuk nombor ini. Pastikan nombor sama macam masa order.' }, { status: 404 })
  }

  // Lebih satu & tiada no order dipilih → minta pelanggan pilih
  if (cands.length > 1 && !on) {
    return NextResponse.json({
      orders: cands.slice(0, 6).map((c) => ({ order_number: c.orderNumber, status: c.status, created_at: c.createdAt })),
    })
  }

  return bind(admin, cands[0], phoneNorm)
}

// Cari order yang padan telefon (+ no order jika diberi), merentas storefront & LP.
async function findCandidates(admin: SupabaseClient, phoneNorm: string, on: string): Promise<Cand[]> {
  const out: Cand[] = []

  // ── Storefront (telefon via profiles, guna RPC sedia ada) ──
  const { data: profMatch } = await admin.rpc('find_profile_by_phone', { p_phone: phoneNorm })
  const profId = (Array.isArray(profMatch) ? profMatch[0]?.id : (profMatch as { id?: string } | null)?.id) as string | undefined
  if (profId) {
    let pq = admin.from('orders').select('id, order_number, status, created_at').eq('user_id', profId).order('created_at', { ascending: false }).limit(10)
    if (on) pq = pq.eq('order_number', on)
    const { data: orders } = await pq
    const { data: prof } = await admin.from('profiles').select('full_name, email').eq('id', profId).maybeSingle()
    for (const o of orders ?? []) out.push({ kind: 'store', orderId: o.id, orderNumber: o.order_number, status: o.status, createdAt: o.created_at, name: prof?.full_name ?? null, email: prof?.email ?? null })
  }

  // ── LP (telefon pada baris — cuba beberapa format simpanan) ──
  const variants = Array.from(new Set([phoneNorm, '0' + phoneNorm.slice(2), phoneNorm.slice(2), '+' + phoneNorm]))
  let lq = admin.from('lp_guest_orders').select('id, order_number, status, created_at, name, email, phone').in('phone', variants).order('created_at', { ascending: false }).limit(10)
  if (on) lq = lq.eq('order_number', on)
  const { data: lps } = await lq
  for (const o of lps ?? []) {
    if (normalizePhone(o.phone) !== phoneNorm) continue // pengesahan ketat
    out.push({ kind: 'lp', orderId: o.id, orderNumber: o.order_number, status: o.status, createdAt: o.created_at, name: o.name ?? null, email: o.email ?? null })
  }

  // Latest dahulu
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

// Buka/sambung aduan untuk order terpilih, pulang token + konteks.
async function bind(admin: SupabaseClient, c: Cand, phoneNorm: string) {
  const { data: existing } = await admin
    .from('support_complaints')
    .select('id')
    .eq('order_id', c.orderId)
    .in('status', ['open', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let complaintId = existing?.id as string | undefined
  if (!complaintId) {
    const { data: created, error } = await admin
      .from('support_complaints')
      .insert({
        order_kind: c.kind, order_id: c.orderId, order_number: c.orderNumber,
        customer_name: c.name, customer_phone: phoneNorm, customer_email: c.email,
        status: 'open',
      })
      .select('id')
      .single()
    if (error || !created) return NextResponse.json({ error: 'Gagal buka aduan.' }, { status: 500 })
    complaintId = created.id
  }
  if (!complaintId) return NextResponse.json({ error: 'Gagal buka aduan.' }, { status: 500 })

  const { data: msgs } = await admin
    .from('support_messages')
    .select('role, content')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    token: issueSupportToken(complaintId),
    order: { number: c.orderNumber, status: c.status, name: c.name },
    messages: msgs ?? [],
  })
}
