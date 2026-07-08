import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

const KEYS = [
  'gateway_fee_fpx_pct',
  'gateway_fee_ewallet_pct',
  'gateway_fee_fixed_rm',
  'pricing_target_margin_pct',
] as const

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data } = await supabase!
    .from('app_settings')
    .select('key, value')
    .in('key', [...KEYS])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return NextResponse.json({
    gateway_fee_fpx_pct: Number(map.gateway_fee_fpx_pct ?? 1.0),
    gateway_fee_ewallet_pct: Number(map.gateway_fee_ewallet_pct ?? 1.5),
    gateway_fee_fixed_rm: Number(map.gateway_fee_fixed_rm ?? 0),
    pricing_target_margin_pct: Number(map.pricing_target_margin_pct ?? 25),
  })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const updates: { key: string; value: string }[] = []
  for (const key of KEYS) {
    const n = Number(body[key])
    if (isFinite(n) && n >= 0) updates.push({ key, value: String(n) })
  }
  if (updates.length === 0) return NextResponse.json({ error: 'Tiada data' }, { status: 400 })

  for (const u of updates) {
    await supabase!.from('app_settings').upsert({ key: u.key, value: u.value }, { onConflict: 'key' })
  }

  return NextResponse.json({ ok: true })
}
