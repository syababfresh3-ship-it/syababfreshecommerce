export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sheet kos & harga gift box ("GIFT BOX CUSTOM 2026"):
// GET  → sheet tersimpan (app_settings.gift_cost_sheet) atau null
// POST → tarik CSV Google Sheet → parse → simpan → { sheet, diff }
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { diffGiftCostSheet, fetchGiftCostSheet, loadGiftCostSheet, saveGiftCostSheet, GIFT_COST_SHEET_CSV_URL } from '@/lib/gift-cost-sheet-server'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sheet = await loadGiftCostSheet(supabase!)
  return NextResponse.json({ sheet, source: GIFT_COST_SHEET_CSV_URL.replace(/\/export.*$/, '') })
}

export async function POST() {
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  try {
    const prev = await loadGiftCostSheet(supabase!)
    const next = await fetchGiftCostSheet()
    await saveGiftCostSheet(supabase!, next)
    revalidateTag('app-settings', 'default')
    console.info('[gift-cost-sheet] ditarik', { rows: next.rows.length, by: user?.email ?? null })
    return NextResponse.json({ ok: true, sheet: next, diff: diffGiftCostSheet(prev, next) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
