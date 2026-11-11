export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sheet harga borong per karton ("Harga Wholesale 2027", 3 tier kuantiti):
// GET  → sheet tersimpan (app_settings.wholesale_sheet) atau null
// POST → tarik CSV Google Sheet → parse → simpan → { sheet, diff }
// Corak sama /api/admin/settings/gift-cost-sheet.
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { diffWholesaleSheet, fetchWholesaleSheet, loadWholesaleSheet, saveWholesaleSheet, WHOLESALE_SHEET_CSV_URL } from '@/lib/wholesale-sheet-server'

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sheet = await loadWholesaleSheet(supabase!)
  return NextResponse.json({ sheet, source: WHOLESALE_SHEET_CSV_URL.replace(/\/export.*$/, '') })
}

export async function POST() {
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  try {
    const prev = await loadWholesaleSheet(supabase!)
    const next = await fetchWholesaleSheet()
    await saveWholesaleSheet(supabase!, next)
    revalidateTag('app-settings', 'default')
    console.info('[wholesale-sheet] ditarik', { rows: next.rows.length, by: user?.email ?? null })
    return NextResponse.json({ ok: true, sheet: next, diff: diffWholesaleSheet(prev, next) })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
