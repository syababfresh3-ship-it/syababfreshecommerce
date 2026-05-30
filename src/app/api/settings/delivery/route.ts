import { NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/app-settings'

export async function GET() {
  const map = await getAppSettings()

  let slots = []
  try { slots = JSON.parse(map.delivery_slots ?? '[]') } catch {}

  return NextResponse.json(
    {
      free_delivery_min: Number(map.free_delivery_min ?? 80),
      default_delivery_fee: Number(map.default_delivery_fee ?? 15),
      slots,
      pickup_enabled: map.pickup_enabled !== 'false',   // default: dibenarkan
    },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' } }
  )
}
