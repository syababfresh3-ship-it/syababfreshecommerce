import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function adminCheck() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? supabase : null
}

export async function GET() {
  const supabase = await adminCheck()
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [{ data: areas }, { data: setting }, { data: carriers }] = await Promise.all([
    supabase
      .from('delivery_zones')
      .select('area_name, delivery_fee, carrier_id, state')
      .eq('is_active', true)
      .order('area_name'),
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'default_delivery_fee')
      .single(),
    supabase
      .from('shipping_carriers')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  // Group by area_name
  const grouped: Record<string, { area_name: string; fee: number; carrier_id: string | null; count: number; state: string | null }> = {}
  for (const row of areas ?? []) {
    if (!grouped[row.area_name]) {
      grouped[row.area_name] = {
        area_name: row.area_name,
        fee: Number(row.delivery_fee),
        carrier_id: row.carrier_id ?? null,
        count: 0,
        state: row.state ?? null,
      }
    }
    grouped[row.area_name].count++
  }

  return NextResponse.json({
    areas: Object.values(grouped).sort((a, b) => a.area_name.localeCompare(b.area_name)),
    default_fee: Number(setting?.value ?? 15),
    carriers: carriers ?? [],
  })
}

export async function PATCH(request: Request) {
  const supabase = await adminCheck()
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  // Update default fee
  if (body.default_fee !== undefined) {
    const { error } = await supabase
      .from('app_settings')
      .update({ value: String(body.default_fee), updated_at: new Date().toISOString() })
      .eq('key', 'default_delivery_fee')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Bulk update fee + carrier for an area_name
  const { area_name, fee, carrier_id } = body
  if (!area_name || fee === undefined) {
    return NextResponse.json({ error: 'area_name dan fee diperlukan' }, { status: 400 })
  }

  const update: Record<string, unknown> = { delivery_fee: Number(fee) }
  if (carrier_id !== undefined) update.carrier_id = carrier_id || null

  const { error } = await supabase
    .from('delivery_zones')
    .update(update)
    .eq('area_name', area_name)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
