import { createClient } from '@/lib/supabase/client'

export interface AppliedPromo {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
}

// Validate a promo code client-side untuk LP checkout (guest — had global sahaja).
// Server (/api/lp/[slug]/order) sahkan semula secara authoritative.
export async function lookupPromo(
  code: string,
  subtotal: number,
): Promise<{ promo?: AppliedPromo; error?: string }> {
  const supabase = createClient()
  const { data } = await supabase
    .from('promo_codes')
    .select('id, code, type, value, min_order, max_uses, uses_count, expires_at')
    .eq('code', code.trim().toUpperCase())
    .eq('active', true)
    .maybeSingle()

  if (!data) return { error: 'Kod tidak sah atau tidak aktif' }
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { error: 'Kod sudah tamat tempoh' }
  if (data.max_uses !== null && data.uses_count >= data.max_uses) return { error: 'Kod sudah mencapai had penggunaan' }
  if (subtotal < Number(data.min_order)) return { error: `Min. pesanan RM${Number(data.min_order).toFixed(2)} untuk kod ini` }

  return { promo: { id: data.id, code: data.code, type: data.type, value: Number(data.value) } }
}

// Kira diskaun dari promo (dihadkan kepada subtotal — tak boleh negatif).
export function promoDiscount(promo: AppliedPromo | null, subtotal: number): number {
  if (!promo) return 0
  return promo.type === 'percentage'
    ? Math.min((subtotal * promo.value) / 100, subtotal)
    : Math.min(promo.value, subtotal)
}
