import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { consignStockBalance, isUuid } from '@/lib/pos/consign'

// Stok konsainan. GET ?consignor=<id> → { balance, moves (200 terkini) }
// POST { consignor_id, product_id, variant_id|null, unit: 'pcs'|'kg', qty, type: 'in'|'return', note?, adjust_stock? }
//   adjust_stock (lalai true, pcs sahaja): 'in' menambah stok kedai (restore_stock), 'return' menolaknya
//   (pos_deduct_stock — tak RAISE). Item kg tidak dijejak dalam stok kedai → log sahaja.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const consignor = new URL(request.url).searchParams.get('consignor')
  if (!isUuid(consignor)) return NextResponse.json({ error: 'consignor is required' }, { status: 400 })
  try {
    const [balance, moves] = await Promise.all([
      consignStockBalance(supabase!, consignor),
      supabase!.from('pos_consign_stock_moves').select('id, unit, qty, type, note, created_at, products(name), product_variants(name)').eq('consignor_id', consignor).order('created_at', { ascending: false }).limit(200),
    ])
    if (moves.error) return NextResponse.json({ error: moves.error.message, balance: [], moves: [] }, { status: 500 })
    type M = { id: string; unit: string; qty: number | string; type: string; note: string | null; created_at: string; products: { name: string } | null; product_variants: { name: string } | null }
    return NextResponse.json({ balance, moves: ((moves.data ?? []) as unknown as M[]).map(m => ({ id: m.id, unit: m.unit, qty: Number(m.qty), type: m.type, note: m.note, created_at: m.created_at, name: m.products?.name ?? '—', variant: m.product_variants?.name ?? null })) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed', balance: [], moves: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { supabase, forbidden, user } = await requireAdmin()
  if (forbidden) return forbidden
  const sb = supabase!
  const b = await request.json().catch(() => ({}))
  if (!isUuid(b.consignor_id) || !isUuid(b.product_id)) return NextResponse.json({ error: 'Supplier and product are required' }, { status: 400 })
  const variantId = isUuid(b.variant_id) ? b.variant_id : null
  const unit = b.unit === 'kg' ? 'kg' : 'pcs'
  const type = b.type === 'return' ? 'return' : 'in'
  const qty = Number(b.qty)
  if (!Number.isFinite(qty) || qty <= 0 || qty > 100_000) return NextResponse.json({ error: 'Quantity must be more than 0' }, { status: 400 })
  if (unit === 'pcs' && !Number.isInteger(qty)) return NextResponse.json({ error: 'Piece quantity must be a whole number' }, { status: 400 })
  const { error } = await sb.from('pos_consign_stock_moves').insert({ consignor_id: b.consignor_id, product_id: b.product_id, variant_id: variantId, unit, qty, type, note: typeof b.note === 'string' ? b.note.trim().slice(0, 200) || null : null, created_by: user?.id ?? null })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  let stockNote: string | null = null
  if (unit === 'pcs' && b.adjust_stock !== false) {
    if (type === 'in') { const r = await sb.rpc('restore_stock', { p_product_id: b.product_id, p_variant_id: variantId, p_quantity: qty }); if (r.error) stockNote = `Recorded, but store stock was not updated: ${r.error.message}` }
    else { const r = await sb.rpc('pos_deduct_stock', { p_product_id: b.product_id, p_variant_id: variantId, p_qty: qty }); if (r.error) stockNote = `Recorded, but store stock was not updated: ${r.error.message}`; else if (Number(r.data ?? 0) > 0) stockNote = `Recorded. Store stock was short by ${Number(r.data)}.` }
  }
  return NextResponse.json({ ok: true, stockNote })
}
