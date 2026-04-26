import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ postcode: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { postcode } = await params
  const body = await request.json()
  const { error } = await supabase!.from('delivery_zones').update(body).eq('postcode', postcode)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ postcode: string }> }) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { postcode } = await params
  const { error } = await supabase!.from('delivery_zones').delete().eq('postcode', postcode)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
