import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data } = await supabase!
    .from('app_settings')
    .select('key, value')
    .in('key', ['free_delivery_min', 'default_delivery_fee', 'delivery_slots'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  let slots = []
  try { slots = JSON.parse(map.delivery_slots ?? '[]') } catch {}

  return NextResponse.json({
    free_delivery_min: Number(map.free_delivery_min ?? 80),
    default_delivery_fee: Number(map.default_delivery_fee ?? 15),
    slots,
  })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const updates: { key: string; value: string }[] = []

  if (typeof body.free_delivery_min === 'number' && body.free_delivery_min >= 0) {
    updates.push({ key: 'free_delivery_min', value: String(body.free_delivery_min) })
  }
  if (typeof body.default_delivery_fee === 'number' && body.default_delivery_fee >= 0) {
    updates.push({ key: 'default_delivery_fee', value: String(body.default_delivery_fee) })
  }
  if (Array.isArray(body.slots)) {
    updates.push({ key: 'delivery_slots', value: JSON.stringify(body.slots) })
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Tiada data' }, { status: 400 })

  for (const u of updates) {
    await supabase!
      .from('app_settings')
      .upsert({ key: u.key, value: u.value }, { onConflict: 'key' })
  }

  revalidateTag('app-settings', 'default')
  return NextResponse.json({ ok: true })
}
