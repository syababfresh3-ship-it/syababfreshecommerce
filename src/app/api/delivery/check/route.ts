import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAppSettings } from '@/lib/app-settings'

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get('postcode')?.trim()

  if (!postcode || !/^\d{5}$/.test(postcode)) {
    return NextResponse.json({ covered: false, error: 'Poskod tidak sah' })
  }

  const [supabase, settings] = await Promise.all([createClient(), getAppSettings()])
  const { data } = await supabase
    .from('delivery_zones')
    .select('postcode, area_name, city, state, frequency, delivery_fee')
    .eq('postcode', postcode)
    .eq('is_active', true)
    .single()

  const defaultFee = Number(settings['default_delivery_fee'] ?? 15)

  if (!data) {
    return NextResponse.json({ covered: false, fee: defaultFee })
  }

  const KV_STATES = ['Selangor', 'W.P. Kuala Lumpur', 'W.P. Putrajaya']
  const isLocal = KV_STATES.includes(data.state ?? '')

  return NextResponse.json({
    covered: isLocal,
    area: data.area_name,
    city: data.city,
    state: data.state,
    frequency: data.frequency,
    fee: isLocal ? Number(data.delivery_fee ?? defaultFee) : defaultFee,
  })
}
