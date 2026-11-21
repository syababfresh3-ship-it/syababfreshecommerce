export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Harga promo SEMENTARA untuk LP borong & sebut harga — dari tab "Harga Promo 2027" (gid 5272027):
// POST { until: 'YYYY-MM-DD', scenario?: 'A'|'B' } → tarik sheet → padankan baris → simpan borong_pricing.promo (+ cache
//   app_settings.wholesale_promo_sheet untuk item picker sebut harga) → revalidate. Promo menimpa Borong RM/tier per produk
//   SEHINGGA tarikh itu (inklusif, tarikh KL); selepas itu harga biasa kembali sendiri — tiada kerja susulan.
// DELETE → tamatkan promo serta-merta (buang promo + cache sheet promo).
// Pertama diguna 21 Nov 2026: "follow harga promo sehingga 10/12" (pemilik).
import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { BORONG_SETTINGS_KEY, parseBorongSettings, normalizeBorongSettings, type BorongSettings } from '@/lib/borong-settings'
import { promoFromSheet } from '@/lib/wholesale-sheet'
import { fetchWholesalePromoSheet, saveWholesalePromoSheet } from '@/lib/wholesale-sheet-server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

async function loadSettings(sb: SB): Promise<BorongSettings> {
  const { data } = await sb.from('app_settings').select('value').eq('key', BORONG_SETTINGS_KEY).maybeSingle()
  return parseBorongSettings(data?.value ?? null)
}
async function saveSettings(sb: SB, settings: BorongSettings): Promise<void> {
  const { error } = await sb.from('app_settings').upsert({ key: BORONG_SETTINGS_KEY, value: JSON.stringify(settings) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  revalidateTag('app-settings', 'default')
  revalidatePath('/kurma/borong')
}

export async function POST(request: Request) {
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => ({}))
  const until = typeof body?.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.until) ? body.until : null
  if (!until) return NextResponse.json({ error: 'Tarikh akhir promo (YYYY-MM-DD) diperlukan' }, { status: 400 })
  const scenario: 'A' | 'B' = body?.scenario === 'B' ? 'B' : 'A'
  try {
    const sheet = await fetchWholesalePromoSheet(scenario, until)
    const { mapped, unmapped, ...promo } = promoFromSheet(sheet, until)
    if (!mapped.length) return NextResponse.json({ error: 'Tiada baris sheet promo yang padan dengan katalog borong' }, { status: 422 })
    const settings = normalizeBorongSettings({ ...(await loadSettings(supabase!)), promo })
    await saveSettings(supabase!, settings)
    await saveWholesalePromoSheet(supabase!, sheet)
    console.info('[borong-promo] diguna', { until, scenario, mapped: mapped.length, unmapped: unmapped.length, by: user?.email ?? null })
    return NextResponse.json({ ok: true, settings, mapped, unmapped, rows: sheet.rows.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function DELETE() {
  const { supabase, user, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  try {
    const settings = normalizeBorongSettings({ ...(await loadSettings(supabase!)), promo: null })
    await saveSettings(supabase!, settings)
    await saveWholesalePromoSheet(supabase!, null)
    console.info('[borong-promo] ditamatkan', { by: user?.email ?? null })
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
