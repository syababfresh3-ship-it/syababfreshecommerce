import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// Item senarai harga POS. GET ?list=<id> → { items } · PATCH { price_list_id, product_id, variant_id|null, price?, price_per_kg? }
// → upsert manual (indeks unik coalesce tak boleh dipakai onConflict); kedua-dua null → baris dipadam ({ item: null }).
export const dynamic = 'force-dynamic'
const UUID = /^[0-9a-f-]{36}$/i
const num = (v: unknown) => { if (v === null || v === '' || v === undefined) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined }

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const list = new URL(request.url).searchParams.get('list')
  if (!list || !UUID.test(list)) return NextResponse.json({ error: 'list is required' }, { status: 400 })
  const { data, error } = await supabase!.from('pos_price_list_items').select('*').eq('price_list_id', list)
  if (error) return NextResponse.json({ error: error.message, items: [] }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const listId = typeof b.price_list_id === 'string' && UUID.test(b.price_list_id) ? b.price_list_id : ''
  const productId = typeof b.product_id === 'string' && UUID.test(b.product_id) ? b.product_id : ''
  const variantId = typeof b.variant_id === 'string' && UUID.test(b.variant_id) ? b.variant_id : null
  if (!listId || !productId) return NextResponse.json({ error: 'price_list_id and product_id are required' }, { status: 400 })

  let q = supabase!.from('pos_price_list_items').select('*').eq('price_list_id', listId).eq('product_id', productId)
  q = variantId ? q.eq('variant_id', variantId) : q.is('variant_id', null)
  const { data: existing, error: e1 } = await q.maybeSingle()
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const next: { price: number | null; price_per_kg: number | null } = { price: existing?.price ?? null, price_per_kg: existing?.price_per_kg ?? null }
  for (const k of ['price', 'price_per_kg'] as const) {
    if (k in b) { const v = num(b[k]); if (v === undefined) return NextResponse.json({ error: `${k} is invalid` }, { status: 400 }); next[k] = v }
  }
  if (next.price == null && next.price_per_kg == null) {
    if (existing) { const { error } = await supabase!.from('pos_price_list_items').delete().eq('id', existing.id); if (error) return NextResponse.json({ error: error.message }, { status: 400 }) }
    return NextResponse.json({ item: null })
  }
  const res = existing
    ? await supabase!.from('pos_price_list_items').update({ ...next, updated_at: new Date().toISOString() }).eq('id', existing.id).select('*').single()
    : await supabase!.from('pos_price_list_items').insert({ price_list_id: listId, product_id: productId, variant_id: variantId, ...next }).select('*').single()
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 400 })
  // touch senarai supaya updated_at berubah (maklumat sahaja; versi katalog ikut max(items.updated_at))
  await supabase!.from('pos_price_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId)
  return NextResponse.json({ item: res.data })
}
