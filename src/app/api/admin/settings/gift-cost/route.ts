import { requireAdmin } from '@/lib/supabase/require-admin'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { GIFT_COST_KEY, parseGiftCostConfig, validateGiftCostConfig } from '@/lib/gift-cost'

// Tetapan kos Custom Gift Box Kurma (admin) — satu kunci app_settings `gift_cost_config` (JSON).
// GET   → { config, exists }   (config sentiasa lengkap bentuknya; exists=false = belum diisi)
// PATCH { config } → sahkan ketat (lib/gift-cost.ts) → upsert → revalidate tag 'app-settings'.
// Corak sama dgn /api/admin/settings/delivery. Dipakai /admin/kurma/costs & panel quote order.

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const { data } = await supabase!.from('app_settings').select('value').eq('key', GIFT_COST_KEY).maybeSingle()
  return NextResponse.json({ config: parseGiftCostConfig(data?.value ?? null), exists: !!data })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const body = await request.json().catch(() => ({}))
  const v = validateGiftCostConfig(body?.config)
  if (!v.ok) return NextResponse.json({ error: `Data tidak sah: ${v.error}` }, { status: 400 })

  const { error } = await supabase!
    .from('app_settings')
    .upsert({ key: GIFT_COST_KEY, value: JSON.stringify(v.cfg) }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag('app-settings', 'default')
  return NextResponse.json({ ok: true, config: v.cfg })
}
