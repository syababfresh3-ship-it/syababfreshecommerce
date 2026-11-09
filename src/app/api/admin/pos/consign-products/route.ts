import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { isUuid } from '@/lib/pos/consign'

// Produk konsainan sesuatu pembekal. GET ?consignor=<id> → { products:[{product_id,name,category,price,unit,commission_pct,cost,variants:[{id,name,price,cost}]}] }
// PATCH { product_id, consignor_id: <uuid>|null, commission_pct?: n|null, cost?: n|null, variant_costs?: [{variant_id, cost: n|null}] }
//   consignor_id null = buang pautan (terma dikosongkan). Jualan lama yang dah dicop TIDAK berubah.
export const dynamic = 'force-dynamic'
const money = (v: unknown) => { if (v === null || v === '' || v === undefined) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined }

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sb = supabase!
  const consignor = new URL(request.url).searchParams.get('consignor')
  if (!isUuid(consignor)) return NextResponse.json({ error: 'consignor is required' }, { status: 400 })
  const { data: rows, error } = await sb.from('pos_product_settings').select('product_id, consign_cost, consign_commission_pct').eq('consignor_id', consignor).is('variant_id', null)
  if (error) return NextResponse.json({ error: error.message, products: [] }, { status: 500 })
  const ids = ((rows ?? []) as { product_id: string }[]).map(r => r.product_id)
  if (ids.length === 0) return NextResponse.json({ products: [] })
  const [prods, vrows] = await Promise.all([
    sb.from('products').select('id, name, price, unit, is_active, categories(name), product_variants(id, name, price, is_active, deleted_at, sort_order)').in('id', ids),
    sb.from('pos_product_settings').select('product_id, variant_id, consign_cost').in('product_id', ids).not('variant_id', 'is', null),
  ])
  const vcost = new Map(((vrows.data ?? []) as { product_id: string; variant_id: string; consign_cost: number | string | null }[]).map(r => [`${r.product_id}:${r.variant_id}`, r.consign_cost == null ? null : Number(r.consign_cost)]))
  const term = new Map(((rows ?? []) as { product_id: string; consign_cost: number | string | null; consign_commission_pct: number | string | null }[]).map(r => [r.product_id, r]))
  type P = { id: string; name: string; price: number | string; unit: string | null; is_active: boolean; categories: { name: string } | null; product_variants: { id: string; name: string; price: number | string; is_active: boolean | null; deleted_at: string | null; sort_order: number | null }[] | null }
  const products = ((prods.data ?? []) as unknown as P[]).map(p => {
    const t = term.get(p.id)
    return {
      product_id: p.id, name: p.name, category: p.categories?.name ?? null, price: Number(p.price), unit: p.unit, is_active: p.is_active,
      commission_pct: t?.consign_commission_pct == null ? null : Number(t.consign_commission_pct), cost: t?.consign_cost == null ? null : Number(t.consign_cost),
      variants: (p.product_variants ?? []).filter(v => v.is_active !== false && !v.deleted_at).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(v => ({ id: v.id, name: v.name, price: Number(v.price), cost: vcost.get(`${p.id}:${v.id}`) ?? null })),
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ products })
}

export async function PATCH(request: Request) {
  const { supabase, forbidden } = await requireAdmin()
  if (forbidden) return forbidden
  const sb = supabase!
  const b = await request.json().catch(() => ({}))
  if (!isUuid(b.product_id)) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
  const productId: string = b.product_id
  const upsert = async (variantId: string | null, patch: Record<string, unknown>) => {
    let q = sb.from('pos_product_settings').select('id').eq('product_id', productId)
    q = variantId ? q.eq('variant_id', variantId) : q.is('variant_id', null)
    const { data: existing, error: e1 } = await q.maybeSingle()
    if (e1) return e1.message
    const res = existing
      ? await sb.from('pos_product_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : await sb.from('pos_product_settings').insert({ product_id: productId, variant_id: variantId, ...patch })
    return res.error ? res.error.message : null
  }

  if (b.consignor_id === null) {     // buang pautan: kosongkan terma produk & kos varian
    const e = await upsert(null, { consignor_id: null, consign_cost: null, consign_commission_pct: null })
    if (e) return NextResponse.json({ error: e }, { status: 400 })
    const { error } = await sb.from('pos_product_settings').update({ consign_cost: null }).eq('product_id', productId).not('variant_id', 'is', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const patch: Record<string, unknown> = {}
  if ('consignor_id' in b) { if (!isUuid(b.consignor_id)) return NextResponse.json({ error: 'consignor_id is invalid' }, { status: 400 }); patch.consignor_id = b.consignor_id }
  if ('commission_pct' in b) { const v = money(b.commission_pct); if (v === undefined || (v !== null && v > 100)) return NextResponse.json({ error: 'Commission must be between 0 and 100' }, { status: 400 }); patch.consign_commission_pct = v }
  if ('cost' in b) { const v = money(b.cost); if (v === undefined) return NextResponse.json({ error: 'Cost is invalid' }, { status: 400 }); patch.consign_cost = v }
  if (Object.keys(patch).length) { const e = await upsert(null, patch); if (e) return NextResponse.json({ error: e }, { status: 400 }) }
  if (Array.isArray(b.variant_costs)) {
    for (const vc of b.variant_costs as { variant_id?: unknown; cost?: unknown }[]) {
      if (!isUuid(vc.variant_id)) continue
      const v = money(vc.cost); if (v === undefined) return NextResponse.json({ error: 'Variant cost is invalid' }, { status: 400 })
      const e = await upsert(vc.variant_id, { consign_cost: v }); if (e) return NextResponse.json({ error: e }, { status: 400 })
    }
  }
  return NextResponse.json({ ok: true })
}
