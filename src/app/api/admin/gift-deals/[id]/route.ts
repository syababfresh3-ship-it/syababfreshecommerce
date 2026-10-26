export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Deal: GET (+events) · PATCH medan manual/peringkat (auto maju bila delivered/artwork ditanda).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadDeal, loadDealRow, parseDealPatch, patchDeal } from '@/lib/gift-deals-server'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  try {
    const row = await loadDealRow(supabase!, id)
    if (!row) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const d = await loadDeal(supabase!, id)
  if (!d) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Data tidak sah' }, { status: 400 })
  const parsed = parseDealPatch(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  try {
    await patchDeal(supabase!, d, parsed.patch, parsed.stageTouched, user?.email ?? null)
    return NextResponse.json(await loadDealRow(supabase!, id))
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
