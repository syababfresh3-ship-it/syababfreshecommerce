import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

const PRODUCT_FIELDS = [
  'name', 'slug', 'description', 'price', 'compare_price', 'unit',
  'is_featured', 'is_active', 'is_shippable', 'sort_order', 'category_id',
  'images', 'weight_grams',
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
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase!.from('products').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { id } = await params
  const { error } = await supabase!.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
