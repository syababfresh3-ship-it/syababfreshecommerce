export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST { reason } → batalkan sebut harga yang dikeluarkan/diterima (draf → DELETE).
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { loadEvents, loadQuotation, logQuotationEvent, rowToQuotation } from '@/lib/quotation-server'
import { refrensQuotationRefFromEvents } from '@/lib/quotation'
import { cancelInvoice, isRefrensConfigured } from '@/lib/refrens'
import { markDealLost } from '@/lib/gift-deals-server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const q = await loadQuotation(supabase!, id)
  if (!q) return NextResponse.json({ error: 'Tidak dijumpai' }, { status: 404 })
  if (!['issued', 'accepted', 'expired'].includes(q.status)) return NextResponse.json({ error: 'Hanya sebut harga yang dikeluarkan boleh dibatalkan' }, { status: 409 })
  const body = await request.json().catch(() => ({})) as { reason?: string }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : ''
  const { data, error } = await supabase!.from('quotations')
    .update({ status: 'cancelled', cancel_reason: reason || null, updated_at: new Date().toISOString() })
    .eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logQuotationEvent(supabase!, id, 'cancelled', { reason }, user?.email ?? null)
  await markDealLost(supabase!, id, reason || 'Sebut harga dibatalkan', user?.email ?? null)   // Pipeline Gift (best-effort)
  // Salinan di Refrens (pilihan 1): batal juga, best-effort — gagal tak menghalang.
  let refrens: 'cancelled' | 'failed' | 'none' = 'none'
  if (isRefrensConfigured()) {
    const ref = refrensQuotationRefFromEvents(await loadEvents(supabase!, id))
    if (ref) {
      try { await cancelInvoice(ref.id, false); refrens = 'cancelled'; await logQuotationEvent(supabase!, id, 'refrens_quotation_cancelled', { number: ref.number }, user?.email ?? null) }
      catch (e) { refrens = 'failed'; console.warn('[refrens] batal sebut harga gagal', ref.number, (e as Error).message) }
    }
  }
  return NextResponse.json({ ...rowToQuotation(data), refrens })
}
