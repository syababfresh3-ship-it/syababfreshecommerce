import { requireAdmin } from '@/lib/supabase/require-admin'
import { revalidateStorefront } from '@/lib/revalidate-store'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const validated = {
    name: body.name,
    slug: body.slug,
    description: body.description ?? null,
    price: Number(body.price),
    compare_price: body.compare_price != null ? Number(body.compare_price) : null,
    unit: body.unit ?? null,
    weight_grams: body.weight_grams != null ? Number(body.weight_grams) : null,
    image_url: body.image_url ?? null,
    images: Array.isArray(body.images) ? body.images.filter((u: unknown) => typeof u === 'string') : [],
    category_id: body.category_id ?? null,
    is_active: body.is_active ?? true,
    is_featured: body.is_featured ?? false,
    sort_order: body.sort_order ?? 0,
    is_shippable: body.is_shippable ?? true,
  }
  const { error, data } = await supabase!.from('products').insert(validated).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateStorefront()
  return NextResponse.json(data)
}
