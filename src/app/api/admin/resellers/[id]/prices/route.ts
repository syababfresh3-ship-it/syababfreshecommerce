import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// Harga borong dipersetujui untuk satu reseller (per produk/variant).
// [id] = reseller_id.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { data, error } = await supabase!
    .from('reseller_prices')
    .select('id, product_id, variant_id, price, products(name), product_variants(name)')
    .eq('reseller_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Upsert satu harga: { product_id, variant_id?, price }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json().catch(() => ({}))
  const product_id = typeof body.product_id === 'string' ? body.product_id : ''
  const variant_id = typeof body.variant_id === 'string' && body.variant_id ? body.variant_id : null
  const price = Number(body.price)
  if (!product_id) return NextResponse.json({ error: 'product_id diperlukan' }, { status: 400 })
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: 'Harga tidak sah' }, { status: 400 })

  // Manual upsert (unique index guna coalesce → onConflict tak padan; padan null guna .is)
  let q = supabase!.from('reseller_prices').select('id').eq('reseller_id', id).eq('product_id', product_id)
  q = variant_id ? q.eq('variant_id', variant_id) : q.is('variant_id', null)
  const { data: existing } = await q.maybeSingle()

  if (existing) {
    const { error } = await supabase!.from('reseller_prices').update({ price, updated_at: new Date().toISOString() }).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase!.from('reseller_prices').insert({ reseller_id: id, product_id, variant_id, price })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// Buang satu harga ikut price-row id: { price_id }
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { price_id } = await request.json().catch(() => ({}))
  if (!price_id) return NextResponse.json({ error: 'price_id diperlukan' }, { status: 400 })
  const { error } = await supabase!.from('reseller_prices').delete().eq('id', price_id).eq('reseller_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
