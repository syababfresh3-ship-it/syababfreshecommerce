import { requireAdmin } from '@/lib/supabase/require-admin'
import { revalidateStorefront } from '@/lib/revalidate-store'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  await Promise.all(
    ids.map((id: string, i: number) =>
      supabase!.from('products').update({ sort_order: i + 1 }).eq('id', id)
    )
  )

  revalidateStorefront()
  return NextResponse.json({ ok: true })
}
