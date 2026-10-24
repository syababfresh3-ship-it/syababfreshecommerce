export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/quotations/prefill?gift_order=<id> → data pra-isi (klien + baris) dari gift order.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { giftOrderPrefill } from '@/lib/quotation-server'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const id = new URL(request.url).searchParams.get('gift_order')
  if (!id) return NextResponse.json({ error: 'gift_order diperlukan' }, { status: 400 })
  const data = await giftOrderPrefill(supabase!, id)
  if (!data) return NextResponse.json({ error: 'Gift order tidak dijumpai' }, { status: 404 })
  return NextResponse.json(data)
}
