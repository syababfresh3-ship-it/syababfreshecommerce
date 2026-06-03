import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidateStorefront } from '@/lib/revalidate-store'
import { NextResponse } from 'next/server'

async function adminCheck() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? supabase : null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await adminCheck()
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', id)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await adminCheck()
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, price, compare_price, weight_grams, stock, sku, sort_order } = body
  if (!name || price === undefined) return NextResponse.json({ error: 'name dan price diperlukan' }, { status: 400 })

  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: id, name, price: Number(price),
      compare_price: compare_price ? Number(compare_price) : null,
      weight_grams: weight_grams ? Number(weight_grams) : null,
      stock: Number(stock ?? 0),
      sku: sku || null,
      sort_order: Number(sort_order ?? 0),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidateStorefront()
  return NextResponse.json(data)
}
