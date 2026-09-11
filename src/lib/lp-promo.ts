import { createClient } from '@/lib/supabase/client'
import { evaluatePromo, promoLabel, PROMO_ERRORS, type PromoItem, type PromoType } from '@/lib/promo-rules'

export type { PromoItem } from '@/lib/promo-rules'

export interface AppliedPromo {
  id: string
  code: string
  type: PromoType
  value: number
  /** Kod jenis 'free_shipping' — papar "Hantar percuma" pada ringkasan. */
  freeShipping?: boolean
  // Skop Sprint 3H — dipakai semula bila kira semula diskaun selepas qty berubah.
  scope_product_ids?: string[] | null
  scope_category_ids?: string[] | null
}

// Validate a promo code client-side untuk LP checkout. Peraturan SAMA dengan
// server (lib/promo-rules) — server (/api/lp/[slug]/order, /api/store/guest-order)
// tetap sahkan semula secara authoritative.
//
// select('*') sengaja: kolum Sprint 3H (starts_at, scope_*, per_user_limit)
// mungkin belum wujud sebelum migration 131 — kolum yang tiada sekadar hilang
// dari baris, bukan error 42703.
export async function lookupPromo(
  code: string,
  subtotal: number,
  opts?: { deliveryFee?: number; items?: PromoItem[] },
): Promise<{ promo?: AppliedPromo; error?: string }> {
  const supabase = createClient()
  const { data } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('active', true)
    .maybeSingle()

  if (!data) return { error: PROMO_ERRORS.invalid }

  const items = opts?.items ?? [{ product_id: '', category_id: null, line_total: subtotal }]
  const verdict = evaluatePromo(data, {
    subtotal,
    deliveryFee: opts?.deliveryFee ?? 0,
    items,
  })
  if (!verdict.ok) return { error: verdict.error }

  return {
    promo: {
      id: data.id,
      code: data.code,
      type: data.type,
      value: Number(data.value),
      freeShipping: verdict.freeShipping,
      scope_product_ids: data.scope_product_ids ?? null,
      scope_category_ids: data.scope_category_ids ?? null,
    },
  }
}

// Kira diskaun dari promo (dihadkan kepada subtotal layak — tak boleh negatif).
// `deliveryFee` diperlukan untuk kod 'free_shipping'; `items` untuk kod berskop
// (tanpa items, skop diabaikan di client — server tetap menguatkuasakannya).
export function promoDiscount(
  promo: AppliedPromo | null,
  subtotal: number,
  deliveryFee = 0,
  items?: PromoItem[],
): number {
  if (!promo) return 0
  const scoped = (promo.scope_product_ids?.length ?? 0) > 0 || (promo.scope_category_ids?.length ?? 0) > 0
  const row = scoped && !items
    ? { ...promo, scope_product_ids: null, scope_category_ids: null }
    : promo
  const verdict = evaluatePromo(row, {
    subtotal,
    deliveryFee,
    items: items ?? [{ product_id: '', category_id: null, line_total: subtotal }],
  })
  return verdict.ok ? verdict.discount : 0
}

// Label ringkas kod ("Hantar percuma" · "10%" · "RM5").
export { promoLabel }
