import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET /api/kurma/catalog — katalog Gift Studio (item AKTIF) untuk /kurma/studio (template + logo_area).
// Dinamik (tiada cache) supaya edit admin terus nampak. Lihat lib/gift.ts.
export const dynamic = 'force-dynamic'

const MISSING_COLUMN = new Set(['42703', 'PGRST204'])
const DESIGN_COLS = 'id, box_id, name, image_url, price_add, sort_order, is_active'

export async function GET() {
  const sb = createAdminClient()
  const [boxes, fillings, designsTry] = await Promise.all([
    sb.from('gift_boxes').select('id, name, slug, description, base_price, image_url, model_url, capacity_label, tiers, weights, sort_order, is_active').eq('is_active', true).order('sort_order'),
    sb.from('gift_fillings').select('id, name, image_url, price, prices, unit, grade, sort_order, is_active').eq('is_active', true).order('sort_order'),
    // logo_area (migration 143) — kawasan logo untuk preview 2D
    sb.from('gift_designs').select(`${DESIGN_COLS}, logo_area`).eq('is_active', true).order('sort_order'),
  ])
  // Migration 143 belum dijalankan → kolum logo_area tiada → ulang tanpanya (template tetap
  // dipapar; studio guna kawasan default). Jangan biar senarai template kosong kerana itu.
  const designs = designsTry.error && MISSING_COLUMN.has(designsTry.error.code ?? '')
    ? await sb.from('gift_designs').select(DESIGN_COLS).eq('is_active', true).order('sort_order')
    : designsTry
  return NextResponse.json({
    boxes: boxes.data ?? [],
    fillings: fillings.data ?? [],
    designs: designs.data ?? [],
  })
}
