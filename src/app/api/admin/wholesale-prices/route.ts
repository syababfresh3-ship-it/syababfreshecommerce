export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Harga borong LALAI per produk/saiz (jadual wholesale_prices, migration 154) — terpakai untuk semua
// pelanggan borong; harga khas per pelanggan (reseller_prices) menimpa. GET senarai · PUT upsert satu · DELETE satu.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

const MISSING_TABLE = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message ?? ''))
const WARN_154 = 'Jadual harga borong belum ada — jalankan migration 154 di SQL Editor.'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data, error } = await supabase!.from('wholesale_prices').select('id, product_id, variant_id, price, updated_at').order('updated_at', { ascending: false })
  if (error) {
    if (MISSING_TABLE(error)) return NextResponse.json({ prices: [], warning: WARN_154 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ prices: data ?? [] })
}

// Upsert satu harga: { product_id, variant_id?, price }
export async function PUT(request: Request) {
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => ({}))
  const product_id = typeof body.product_id === 'string' ? body.product_id : ''
  const variant_id = typeof body.variant_id === 'string' && body.variant_id ? body.variant_id : null
  const price = Number(body.price)
  if (!product_id) return NextResponse.json({ error: 'product_id diperlukan' }, { status: 400 })
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: 'Harga tidak sah' }, { status: 400 })

  // Manual upsert (unique index guna coalesce → onConflict tak padan; padan null guna .is)
  let q = supabase!.from('wholesale_prices').select('id').eq('product_id', product_id)
  q = variant_id ? q.eq('variant_id', variant_id) : q.is('variant_id', null)
  const { data: existing, error: selErr } = await q.maybeSingle()
  if (selErr && MISSING_TABLE(selErr)) return NextResponse.json({ error: WARN_154 }, { status: 409 })
  const now = new Date().toISOString()
  if (existing) {
    const { error } = await supabase!.from('wholesale_prices').update({ price, updated_at: now, updated_by: user?.id ?? null }).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: existing.id })
  }
  const { data, error } = await supabase!.from('wholesale_prices').insert({ product_id, variant_id, price, updated_by: user?.id ?? null }).select('id').single()
  if (error) return NextResponse.json({ error: MISSING_TABLE(error) ? WARN_154 : error.message }, { status: MISSING_TABLE(error) ? 409 : 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}

// Buang satu harga: { price_id }
export async function DELETE(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { price_id } = await request.json().catch(() => ({}))
  if (typeof price_id !== 'string' || !price_id) return NextResponse.json({ error: 'price_id diperlukan' }, { status: 400 })
  const { error } = await supabase!.from('wholesale_prices').delete().eq('id', price_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
