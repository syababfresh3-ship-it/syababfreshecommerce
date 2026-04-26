import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function adminCheck() {
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return null
  const supabase = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? supabase : null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { variantId } = await params
  const supabase = await adminCheck()
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = body.name
  if (body.price !== undefined) update.price = Number(body.price)
  if (body.compare_price !== undefined) update.compare_price = body.compare_price ? Number(body.compare_price) : null
  if (body.weight_grams !== undefined) update.weight_grams = body.weight_grams ? Number(body.weight_grams) : null
  if (body.stock !== undefined) update.stock = Number(body.stock)
  if (body.sku !== undefined) update.sku = body.sku || null
  if (body.is_active !== undefined) update.is_active = body.is_active
  if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order)

  const { error } = await supabase.from('product_variants').update(update).eq('id', variantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { variantId } = await params
  const supabase = await adminCheck()
  if (!supabase) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('product_variants').delete().eq('id', variantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
