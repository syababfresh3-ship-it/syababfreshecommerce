import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// PATCH: upsert kos untuk satu variant (atau product-level bila variant_id null).
// Partial unique index tak boleh guna .upsert onConflict — select dulu, update/insert.
export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const { product_id, variant_id } = body as { product_id?: string; variant_id?: string | null }
  if (!product_id) return NextResponse.json({ error: 'product_id diperlukan' }, { status: 400 })

  const fields = ['kos_buah', 'kos_packaging', 'kos_kurier', 'kos_lain'] as const
  const values: Record<string, number> = {}
  for (const f of fields) {
    const n = Number(body[f])
    if (!isFinite(n) || n < 0) return NextResponse.json({ error: `${f} mesti nombor >= 0` }, { status: 400 })
    values[f] = Math.round(n * 100) / 100
  }

  const source = body.source === 'tiktok-catalog' || body.source === 'sheet' ? body.source : 'manual'
  const now = new Date().toISOString()

  let query = supabase!.from('variant_costs').select('id').eq('product_id', product_id)
  query = variant_id ? query.eq('variant_id', variant_id) : query.is('variant_id', null)
  const { data: existing } = await query.maybeSingle()

  if (existing) {
    const { error } = await supabase!
      .from('variant_costs')
      .update({ ...values, source, updated_at: now })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase!
      .from('variant_costs')
      .insert({ product_id, variant_id: variant_id ?? null, ...values, source, updated_at: now })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
