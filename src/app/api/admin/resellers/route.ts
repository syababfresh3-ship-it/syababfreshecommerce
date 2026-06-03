import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// Admin CRUD reseller. Reseller = customer master yang dipromosi (1-1).
// Promote: cipta baris resellers + tanda customers.is_reseller = true.

function genReferralCode(name: string | null): string {
  const base = (name || 'RS').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'RS'
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}${rand}`
}

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data, error } = await supabase!
    .from('resellers')
    .select('*, customers(id, name, phone_norm, email, order_count, total_spend)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { customer_id } = await request.json().catch(() => ({}))
  if (!customer_id) return NextResponse.json({ error: 'customer_id diperlukan' }, { status: 400 })

  const { data: cust } = await supabase!.from('customers').select('id, name, is_reseller').eq('id', customer_id).maybeSingle()
  if (!cust) return NextResponse.json({ error: 'Customer tidak dijumpai' }, { status: 404 })

  // Cipta reseller (retry sekali kalau referral_code bertembung)
  let reseller = null, lastErr = null
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase!
      .from('resellers')
      .insert({
        customer_id,
        status: 'active',
        joined_at: new Date().toISOString().slice(0, 10),
        referral_code: genReferralCode(cust.name),
      })
      .select()
      .single()
    if (!error) { reseller = data; break }
    if (error.code === '23505' && error.message.includes('referral_code')) { lastErr = error; continue }
    // sudah reseller (unique customer_id) atau ralat lain
    if (error.code === '23505') return NextResponse.json({ error: 'Customer ini sudah reseller' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!reseller) return NextResponse.json({ error: lastErr?.message ?? 'Gagal cipta reseller' }, { status: 500 })

  await supabase!.from('customers').update({ is_reseller: true }).eq('id', customer_id)
  return NextResponse.json(reseller, { status: 201 })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json().catch(() => ({}))
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const f of ['status', 'wholesale_tier', 'commission_rate', 'territory', 'agreement_notes'] as const) {
    if (f in body) patch[f] = body[f]
  }

  const { data, error } = await supabase!.from('resellers').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id, customer_id } = await request.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })

  const { error } = await supabase!.from('resellers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (customer_id) await supabase!.from('customers').update({ is_reseller: false }).eq('id', customer_id)
  return NextResponse.json({ ok: true })
}
