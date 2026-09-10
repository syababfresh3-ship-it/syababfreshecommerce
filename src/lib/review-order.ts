import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReviewSource } from '@/lib/review-token'

// ============================================================
// Muat order untuk page /ulasan dan simpan ulasan tetamu/member melalui
// service role (migration 126). Dikongsi page + API.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export interface ReviewOrderItem { product_id: string; product_name: string; slug: string | null; image_url: string | null }
export interface ReviewOrder {
  source: ReviewSource
  id: string
  order_number: string
  name: string
  user_id: string | null
  status: string
  items: ReviewOrderItem[]
  existing: Record<string, { rating: number; comment: string | null }>
}

const MISSING = new Set(['42703', '42P01', 'PGRST204', 'PGRST205'])

export async function loadReviewOrder(sb: SB, source: ReviewSource, orderId: string): Promise<ReviewOrder | null> {
  let base: Omit<ReviewOrder, 'existing'> | null = null

  if (source === 'storefront') {
    const { data: o } = await sb
      .from('orders')
      .select('id, order_number, user_id, status, order_items(product_id, product_name, products(slug, image_url))')
      .eq('id', orderId).maybeSingle()
    if (!o) return null
    let name = 'Pelanggan'
    if (o.user_id) {
      const { data: prof } = await sb.from('profiles').select('full_name').eq('id', o.user_id).maybeSingle()
      if (prof?.full_name) name = prof.full_name
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = ((o.order_items as any[]) ?? []).map(i => ({
      product_id: i.product_id, product_name: i.product_name, slug: i.products?.slug ?? null, image_url: i.products?.image_url ?? null,
    }))
    base = { source, id: o.id, order_number: o.order_number, name, user_id: o.user_id ?? null, status: o.status, items }
  } else {
    const { data: o } = await sb
      .from('lp_guest_orders')
      .select('id, order_number, name, user_id, status, items')
      .eq('id', orderId).maybeSingle()
    if (!o) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = ((o.items as any[]) ?? []).filter(i => i?.product_id)
    const ids = [...new Set(raw.map(i => i.product_id as string))]
    const { data: prods } = ids.length ? await sb.from('products').select('id, slug, image_url').in('id', ids) : { data: [] }
    const byId = new Map((prods ?? []).map(p => [p.id, p]))
    const seen = new Set<string>()
    const items: ReviewOrderItem[] = []
    for (const i of raw) {
      if (seen.has(i.product_id)) continue
      seen.add(i.product_id)
      items.push({ product_id: i.product_id, product_name: i.product_name ?? 'Produk', slug: byId.get(i.product_id)?.slug ?? null, image_url: byId.get(i.product_id)?.image_url ?? null })
    }
    base = { source, id: o.id, order_number: o.order_number, name: o.name ?? 'Pelanggan', user_id: o.user_id ?? null, status: o.status, items }
  }

  // Ulasan sedia ada untuk order ini (pautan dibuka semula → prefill)
  const existing: ReviewOrder['existing'] = {}
  const { data: byRef, error } = await sb
    .from('product_reviews').select('product_id, rating, comment')
    .eq('order_source', source).eq('order_ref', base.order_number)
  if (!error) for (const r of byRef ?? []) existing[r.product_id] = { rating: r.rating, comment: r.comment }
  if (source === 'storefront') {
    const { data: byOrder } = await sb.from('product_reviews').select('product_id, rating, comment').eq('order_id', orderId)
    for (const r of byOrder ?? []) existing[r.product_id] = { rating: r.rating, comment: r.comment }
  }
  return { ...base, existing }
}

export interface ReviewInput { product_id: string; rating: number; comment: string | null }

// Simpan (insert / kemas kini) — pulang bilangan disimpan atau mesej ralat.
export async function saveOrderReviews(sb: SB, order: ReviewOrder, reviews: ReviewInput[]): Promise<{ saved: number; error?: string }> {
  const allowed = new Set(order.items.map(i => i.product_id))
  let saved = 0
  for (const r of reviews) {
    if (!allowed.has(r.product_id)) continue
    const rating = Math.round(Number(r.rating))
    if (!(rating >= 1 && rating <= 5)) continue
    const comment = (r.comment ?? '').trim().slice(0, 500) || null

    // Sudah ada? (ulasan lama page produk ikut order_id, atau ulasan pautan ikut order_ref)
    let existingId: string | null = null
    if (order.source === 'storefront') {
      const { data } = await sb.from('product_reviews').select('id').eq('order_id', order.id).eq('product_id', r.product_id).maybeSingle()
      existingId = data?.id ?? null
    }
    if (!existingId) {
      const { data } = await sb.from('product_reviews').select('id')
        .eq('order_source', order.source).eq('order_ref', order.order_number).eq('product_id', r.product_id).maybeSingle()
      existingId = data?.id ?? null
    }

    if (existingId) {
      const { error } = await sb.from('product_reviews').update({ rating, comment }).eq('id', existingId)
      if (error) return { saved, error: error.message }
    } else {
      const { error } = await sb.from('product_reviews').insert({
        product_id: r.product_id,
        user_id: order.user_id,                      // null untuk tetamu (migration 126)
        order_id: order.source === 'storefront' ? order.id : null,
        rating, comment,
        guest_name: order.name,
        order_source: order.source,
        order_ref: order.order_number,
      })
      if (error) {
        if (MISSING.has(error.code ?? '') || /null value in column "user_id"/.test(error.message))
          return { saved, error: 'Ulasan tanpa login belum diaktifkan (migration 126)' }
        return { saved, error: error.message }
      }
    }
    saved++
  }
  return { saved }
}
