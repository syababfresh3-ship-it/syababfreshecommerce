import { requireAdmin } from '@/lib/supabase/require-admin'
import { revalidateStorefront } from '@/lib/revalidate-store'
import { NextResponse } from 'next/server'

const PRODUCT_FIELDS = [
  'variant_options', // dimensi variasi (migration 136)
  'name', 'slug', 'description', 'price', 'compare_price', 'unit',
  'is_featured', 'is_active', 'is_shippable', 'sort_order', 'category_id',
  'image_url', 'images', 'weight_grams', 'show_in_storefront',
  'affiliate_pct', // kadar komisen affiliate (migration 139)
] as const

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const body = await request.json()

  // Allowlist — prevent mass assignment of read-only fields (id, created_at, etc.)
  const update: Record<string, unknown> = {}
  for (const key of PRODUCT_FIELDS) {
    if (key in body) update[key] = body[key]
  }
  // Kadar komisen affiliate dihadkan 0..1 di pelayan (klien hantar %/100; migration 139/165)
  if ('affiliate_pct' in update) update.affiliate_pct = Math.min(1, Math.max(0, Number(update.affiliate_pct) || 0))
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase!.from('products').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateStorefront()
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const { error } = await supabase!.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateStorefront()
  return NextResponse.json({ ok: true })
}
