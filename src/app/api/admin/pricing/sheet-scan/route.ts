import { requireAdmin } from '@/lib/supabase/require-admin'
import { buildSuggestions } from '@/lib/pricing/sheet-sync'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// POST: baca sheet invois → bina cadangan kos → segar semula senarai 'pending'.
// Cadang sahaja; tiada apa ditulis ke variant_costs di sini (admin sahkan kemudian).
export async function POST() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden

  let result
  try {
    result = await buildSuggestions(supabase!)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal baca sheet' }, { status: 502 })
  }
  const { suggestions, skipped, sheetRows } = result

  // Pending = hasil scan terkini. Buang pending lama, ganti dengan set baru.
  // Rekod 'applied'/'ignored' dikekalkan (tak disentuh).
  const del = await supabase!.from('cost_suggestions').delete().eq('status', 'pending')
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })

  if (suggestions.length) {
    const rows = suggestions.map((s) => ({
      product_id: s.product_id,
      variant_id: s.variant_id,
      kos_buah_lama: s.kos_buah_lama,
      kos_buah_baru: s.kos_buah_baru,
      breakdown: s.breakdown,
      status: 'pending',
    }))
    const ins = await supabase!.from('cost_suggestions').insert(rows)
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    baris_sheet: sheetRows,
    cadangan: suggestions.length,
    dilangkau: skipped.length,
    skipped: skipped.slice(0, 40),
  })
}
