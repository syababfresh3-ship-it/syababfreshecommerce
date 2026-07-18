import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'

// PATCH: sahkan satu cadangan kos. { id, action: 'apply' | 'ignore' }
// apply → tulis kos_buah SAHAJA ke variant_costs (kekalkan packaging/kurier/lain),
//         source 'sheet'. Bukan auto — dicetuskan bila admin tekan "Guna".
export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  const body = await request.json()
  const { id, action } = body as { id?: string; action?: string }
  if (!id) return NextResponse.json({ error: 'id diperlukan' }, { status: 400 })
  if (action !== 'apply' && action !== 'ignore') {
    return NextResponse.json({ error: "action mesti 'apply' atau 'ignore'" }, { status: 400 })
  }

  const { data: sug, error: sugErr } = await supabase!
    .from('cost_suggestions')
    .select('id, product_id, variant_id, kos_buah_baru, status')
    .eq('id', id)
    .maybeSingle()
  if (sugErr) return NextResponse.json({ error: sugErr.message }, { status: 500 })
  if (!sug) return NextResponse.json({ error: 'Cadangan tak dijumpai' }, { status: 404 })
  if (sug.status !== 'pending') return NextResponse.json({ error: 'Cadangan sudah diselesaikan' }, { status: 409 })

  const now = new Date().toISOString()

  if (action === 'apply') {
    const kosBaru = Math.round(Number(sug.kos_buah_baru) * 100) / 100

    // Tulis kos_buah SAHAJA — kekalkan packaging/kurier/lain (select-then-update/insert
    // sebab partial unique index tak boleh guna .upsert onConflict).
    let q = supabase!.from('variant_costs').select('id').eq('product_id', sug.product_id)
    q = sug.variant_id ? q.eq('variant_id', sug.variant_id) : q.is('variant_id', null)
    const { data: existing } = await q.maybeSingle()

    if (existing) {
      const { error } = await supabase!
        .from('variant_costs')
        .update({ kos_buah: kosBaru, source: 'sheet', updated_at: now })
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase!.from('variant_costs').insert({
        product_id: sug.product_id,
        variant_id: sug.variant_id ?? null,
        kos_buah: kosBaru,
        kos_packaging: 0,
        kos_kurier: 0,
        kos_lain: 0,
        source: 'sheet',
        updated_at: now,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { error: updErr } = await supabase!
    .from('cost_suggestions')
    .update({ status: action === 'apply' ? 'applied' : 'ignored', resolved_at: now })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
