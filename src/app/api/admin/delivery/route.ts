import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

const ZONE_FIELDS = ['postcode', 'area_name', 'city', 'state', 'delivery_fee', 'is_active', 'frequency', 'courier_override'] as const
const MAX_BULK_ROWS = 2000

function sanitizeZone(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of ZONE_FIELDS) {
    if (key in row) out[key] = row[key]
  }
  return out
}

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data } = await supabase!.from('delivery_zones').select('*').order('postcode')
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()

  if (body.bulk && Array.isArray(body.rows)) {
    if (body.rows.length > MAX_BULK_ROWS) {
      return NextResponse.json({ error: `Maksimum ${MAX_BULK_ROWS} baris sekaligus` }, { status: 400 })
    }
    const sanitized = body.rows.map((r: Record<string, unknown>) => sanitizeZone(r))
    const { error } = await supabase!.from('delivery_zones').upsert(sanitized)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, count: sanitized.length })
  }

  const { error } = await supabase!.from('delivery_zones').upsert(sanitizeZone(body))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
