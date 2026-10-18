import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import { BORONG_SETTINGS_KEY, parseBorongSettings, normalizeBorongSettings, wholesaleWith, effectiveTerms } from '@/lib/borong-settings'
import { BORONG_CATALOG } from '@/lib/borong-pricing'
import { getBorongProducts } from '@/lib/borong-data'

// Tetapan harga & terma borong (admin /admin/borong) — satu kunci app_settings `borong_pricing` (JSON).
// GET   → { settings, exists, rows } (rows = katalog + harga runcit DB + harga borong berkesan, untuk jadual admin)
// PATCH { settings } → bersihkan (lib/borong-settings.ts) → upsert → revalidate 'app-settings' + /kurma/borong.
// Corak sama dgn /api/admin/settings/gift-cost.

async function rowsFor(settings: ReturnType<typeof parseBorongSettings>) {
  const products = await getBorongProducts(BORONG_CATALOG.map(e => e.slug))
  return BORONG_CATALOG.map(e => {
    const p = products.get(e.slug)
    const retailCtn = p?.variants.find(v => v.name === e.pack)?.price ?? null
    return { slug: e.slug, name: e.nameOverride ?? p?.name ?? e.slug, group: e.group, grade: e.grade, pack: e.pack, packKg: e.packKg, found: !!p, retailCtn, fileRef: e.refPriceCtn, effective: wholesaleWith(settings, e, retailCtn) }
  })
}

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data } = await supabase!.from('app_settings').select('value').eq('key', BORONG_SETTINGS_KEY).maybeSingle()
  const settings = parseBorongSettings(data?.value ?? null)
  return NextResponse.json({ settings, exists: !!data, rows: await rowsFor(settings), terms: effectiveTerms(settings) })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => ({}))
  if (!body?.settings || typeof body.settings !== 'object') return NextResponse.json({ error: 'settings diperlukan' }, { status: 400 })
  const settings = normalizeBorongSettings(body.settings)

  const { error } = await supabase!.from('app_settings').upsert({ key: BORONG_SETTINGS_KEY, value: JSON.stringify(settings) }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('app-settings', 'default')
  revalidatePath('/kurma/borong')   // LP ISR 5 min → tunjuk harga baharu serta-merta
  return NextResponse.json({ ok: true, settings, rows: await rowsFor(settings) })
}
