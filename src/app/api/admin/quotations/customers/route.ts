export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/quotations/customers?q= → picker klien (nama/syarikat/telefon) dengan
// lajur syarikat (migration 146); fallback tanpa lajur itu jika migration belum jalan.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { normalizePhone } from '@/lib/phone'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = (new URL(request.url).searchParams.get('q') ?? '').replace(/[,()*\\%]/g, ' ').trim()
  if (q.length < 2) return NextResponse.json([])
  const phone = normalizePhone(q)

  const run = async (withCompany: boolean) => {
    const cols = withCompany ? 'id, name, phone_norm, email, address, company, company_reg_no, tin, billing_address' : 'id, name, phone_norm, email, address'
    const or = [`name.ilike.%${q}%`, ...(withCompany ? [`company.ilike.%${q}%`] : []), ...(phone ? [`phone_norm.ilike.%${phone}%`] : [])]
    return supabase!.from('customers').select(cols).or(or.join(',')).order('total_spend', { ascending: false }).limit(15)
  }
  let { data, error } = await run(true)
  if (error && (error.code === '42703' || error.code === 'PGRST204')) ({ data, error } = await run(false))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
