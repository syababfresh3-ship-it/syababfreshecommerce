import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['free_delivery_min', 'default_delivery_fee', 'delivery_slots'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  let slots = []
  try { slots = JSON.parse(map.delivery_slots ?? '[]') } catch {}

  return NextResponse.json(
    {
      free_delivery_min: Number(map.free_delivery_min ?? 80),
      default_delivery_fee: Number(map.default_delivery_fee ?? 15),
      slots,
    },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' } }
  )
}
