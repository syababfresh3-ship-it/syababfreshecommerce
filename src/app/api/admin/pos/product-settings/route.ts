import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'

// Tetapan POS per produk/varian (admin /admin/pos/products). Produk kedai TIDAK diubah.
// GET   → { products:[{id,name,unit,price,category,variants:[{id,name,price,sku,stock}]}], settings:[...] }
// PATCH { product_id, variant_id|null, patch:{ pos_name?, sell_by_weight?, price_per_kg?, pos_price?, barcode?, is_quick_key?, quick_key_order?, is_hidden? } }
//       → upsert manual (indeks unik berasaskan ungkapan coalesce tidak boleh dipakai onConflict).
export const dynamic = 'force-dynamic'

const MISSING = new Set(['42P01', 'PGRST205'])

export async function GET() {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const [{ data: products, error: pErr }, settingsRes] = await Promise.all([
    supabase!.from('products')
      .select('id, name, unit, price, is_active, sort_order, categories(name), product_variants(id, name, price, sku, stock, is_active, sort_order, deleted_at)')
      .eq('is_active', true).order('sort_order'),
    supabase!.from('pos_product_settings').select('*'),
  ])
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (settingsRes.error && !MISSING.has(settingsRes.error.code ?? '')) return NextResponse.json({ error: settingsRes.error.message }, { status: 500 })
  type Row = { id: string; name: string; unit: string | null; price: number; categories: { name: string } | null; product_variants: { id: string; name: string; price: number; sku: string | null; stock: number | null; is_active: boolean | null; sort_order: number | null; deleted_at: string | null }[] | null }
  const list = ((products ?? []) as unknown as Row[]).map(p => ({
    id: p.id, name: p.name, unit: p.unit, price: Number(p.price), category: p.categories?.name ?? null,
    variants: (p.product_variants ?? []).filter(v => v.is_active !== false && !v.deleted_at).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(v => ({ id: v.id, name: v.name, price: Number(v.price), sku: v.sku, stock: v.stock })),
  }))
  return NextResponse.json({ products: list, settings: settingsRes.data ?? [], migrationOk: !settingsRes.error })
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null)
const num = (v: unknown) => { if (v === null || v === '' || v === undefined) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined }

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const b = await request.json().catch(() => ({}))
  const productId = typeof b.product_id === 'string' ? b.product_id : ''
  const variantId = typeof b.variant_id === 'string' ? b.variant_id : null
  const p = (b.patch && typeof b.patch === 'object' ? b.patch : {}) as Record<string, unknown>
  if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('pos_name' in p) patch.pos_name = str(p.pos_name, 80)
  if ('barcode' in p) patch.barcode = str(p.barcode, 64)
  if ('sell_by_weight' in p) patch.sell_by_weight = !!p.sell_by_weight
  if ('is_quick_key' in p) patch.is_quick_key = !!p.is_quick_key
  if ('is_hidden' in p) patch.is_hidden = !!p.is_hidden
  if ('quick_key_order' in p) patch.quick_key_order = Math.max(0, Math.min(999, Math.round(Number(p.quick_key_order) || 0)))
  for (const k of ['price_per_kg', 'pos_price'] as const) {
    if (k in p) { const v = num(p[k]); if (v === undefined) return NextResponse.json({ error: `${k} is invalid` }, { status: 400 }); patch[k] = v }
  }

  let q = supabase!.from('pos_product_settings').select('id').eq('product_id', productId)
  q = variantId ? q.eq('variant_id', variantId) : q.is('variant_id', null)
  const { data: existing, error: e1 } = await q.maybeSingle()
  if (e1) return NextResponse.json({ error: MISSING.has(e1.code ?? '') ? 'Migration 155 (POS) has not been run' : e1.message }, { status: MISSING.has(e1.code ?? '') ? 503 : 500 })

  const res = existing
    ? await supabase!.from('pos_product_settings').update(patch).eq('id', existing.id).select('*').single()
    : await supabase!.from('pos_product_settings').insert({ product_id: productId, variant_id: variantId, ...patch }).select('*').single()
  // 23505 boleh datang dari DUA indeks unik: barcode (pos_product_settings_barcode_idx) atau (product_id, variant_id)
  // bila dua tab simpan item yang sama serentak (select-then-insert berlumba) — bezakan supaya mesej tak mengelirukan
  if (res.error) {
    const dupBarcode = res.error.code === '23505' && /barcode/i.test(`${res.error.message} ${res.error.details ?? ''}`)
    const msg = res.error.code === '23505' ? (dupBarcode ? 'Barcode is already used by another item' : 'This item was saved by someone else at the same time — refresh and try again') : res.error.message
    return NextResponse.json({ error: msg }, { status: res.error.code === '23505' && !dupBarcode ? 409 : 400 })
  }
  return NextResponse.json({ setting: res.data })
}
