// ============================================================
// lp-promo-rules-server — bahagian PELAYAN peraturan promo LP (migration 160):
// baca tetapan (toleran lajur belum wujud) & kira baki kuota ikut order LP ini.
// ============================================================
import { activeRules, type LpPromoRules } from '@/lib/lp-promo-rules'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

/** Peraturan aktif LP ikut slug. Lajur belum wujud (migration 160 belum jalan) → null. */
export async function loadPromoRules(sb: SB, slug: string): Promise<LpPromoRules | null> {
  const { data, error } = await sb.from('landing_pages').select('promo_rules').eq('slug', slug).eq('is_active', true).maybeSingle()
  if (error || !data) return null
  return activeRules((data as { promo_rules?: unknown }).promo_rules)
}

/**
 * Baki kuota per product_id untuk LP ini. Order 'cancelled' tidak dikira.
 * Kuota dikunci ikut slug produk dalam peraturan; diterjemah ke id di sini.
 */
export async function quotaRemaining(sb: SB, pageId: string, rules: LpPromoRules | null): Promise<Record<string, number>> {
  const slugs = Object.keys(rules?.quotas ?? {}).filter(k => !k.includes(':'))
  if (!rules || slugs.length === 0) return {}

  const { data: prods } = await sb.from('products').select('id, slug').in('slug', slugs)
  const idBySlug = new Map<string, string>(((prods ?? []) as { id: string; slug: string }[]).map(p => [p.slug.toLowerCase(), p.id]))
  const limitById = new Map<string, number>()
  for (const s of slugs) { const id = idBySlug.get(s); if (id) limitById.set(id, rules.quotas[s]) }
  if (limitById.size === 0) return {}

  const { data: orders } = await sb.from('lp_guest_orders')
    .select('items, product_id, quantity, status')
    .eq('page_id', pageId)
    .neq('status', 'cancelled')
    .limit(5000)

  const sold = new Map<string, number>()
  for (const o of (orders ?? []) as { items?: { product_id?: string; quantity?: number }[] | null; product_id?: string; quantity?: number }[]) {
    const lines = Array.isArray(o.items) && o.items.length > 0 ? o.items : [{ product_id: o.product_id, quantity: o.quantity }]
    for (const l of lines) {
      if (!l.product_id || !limitById.has(l.product_id)) continue
      sold.set(l.product_id, (sold.get(l.product_id) ?? 0) + Number(l.quantity ?? 0))
    }
  }
  const out: Record<string, number> = {}
  for (const [id, limit] of limitById) out[id] = Math.max(0, limit - (sold.get(id) ?? 0))
  return out
}
