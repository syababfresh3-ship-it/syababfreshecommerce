import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get('postcode')?.trim()

  if (!postcode || !/^\d{5}$/.test(postcode)) {
    return NextResponse.json({ covered: false, error: 'Poskod tidak sah' })
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('delivery_zones')
    .select('postcode, area_name, city, state, frequency, delivery_fee')
    .eq('postcode', postcode)
    .eq('is_active', true)
    .single()

  if (!data) {
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'default_delivery_fee')
      .single()
    return NextResponse.json({ covered: false, fee: Number(setting?.value ?? 15) })
  }

  return NextResponse.json({
    covered: true,
    area: data.area_name,
    city: data.city,
    state: data.state,
    frequency: data.frequency,
    fee: Number(data.delivery_fee ?? 15),
  })
}
