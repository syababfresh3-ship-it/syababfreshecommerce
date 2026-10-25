export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST → tarik bayaran invois Refrens berpaut; isi deposit/baki yang masih kosong (manual tak ditimpa).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadDeal, loadDealRow, syncDealFromRefrens } from '@/lib/gift-deals-server'
import { RefrensError } from '@/lib/refrens'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const d = await loadDeal(supabase!, id)
  if (!d) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  try {
    const row = await loadDealRow(supabase!, id)
    const res = await syncDealFromRefrens(supabase!, d, row?.invoice ?? null, user?.email ?? null)
    return NextResponse.json({ ok: true, changed: res.changed, paid: res.paid, note: res.note, deal: await loadDealRow(supabase!, id) })
  } catch (e) {
    if (e instanceof RefrensError) return NextResponse.json({ error: e.message }, { status: e.status >= 500 ? 502 : 400 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
