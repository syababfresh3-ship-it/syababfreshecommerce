import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function GET(req: Request) {
  const carrier_id = new URL(req.url).searchParams.get('carrier_id')
  const admin = createAdminClient()
  let query = admin.from('shipping_weight_tiers').select('*').order('carrier_id').order('min_kg')
  if (carrier_id) query = query.eq('carrier_id', carrier_id)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tiers: data ?? [] })
}

export async function POST(req: Request) {
  if (!await assertAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { carrier_id, min_kg, max_kg, fee } = await req.json()
  if (!carrier_id || min_kg == null || fee == null)
    return NextResponse.json({ error: 'carrier_id, min_kg dan fee diperlukan' }, { status: 400 })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shipping_weight_tiers')
    .insert({ carrier_id, min_kg: Number(min_kg), max_kg: max_kg != null ? Number(max_kg) : null, fee: Number(fee) })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tier: data })
}
