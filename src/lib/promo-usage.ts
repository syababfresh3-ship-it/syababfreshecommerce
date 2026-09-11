// Kiraan "berapa kali pelanggan ini dah guna kod promosi" untuk jalur GUEST
// (lp_guest_orders + orders bila ada sesi login). Diasingkan dari promo-rules
// supaya promo-rules kekal pure/boleh diuji tanpa DB.
//
// Query ini HANYA dijalankan bila admin set per_user_limit — jalur lama (null)
// tidak menambah sebarang query, jadi tiada kesan pada IO budget Supabase.
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from './phone'

// Had baris yang diperiksa — kod promosi guest jarang melebihi ini, dan
// kita cuma perlu tahu sama ada kiraan dah cecah had.
const SCAN_LIMIT = 1000

/**
 * Bilangan order tidak-dibatalkan milik telefon ini (dan user_id kalau login)
 * yang guna promo tersebut. Telefon dinormalisasi dalam JS sebab
 * lp_guest_orders.phone disimpan mentah (bukan bentuk kanonik 60xxxxxxxxx).
 */
export async function countGuestPromoUses(
  supabase: SupabaseClient,
  promoId: string,
  phone: string | null | undefined,
  userId?: string | null,
): Promise<number> {
  const target = normalizePhone(phone)
  let uses = 0

  if (target) {
    const { data } = await supabase
      .from('lp_guest_orders')
      .select('phone')
      .eq('promo_code_id', promoId)
      .neq('status', 'cancelled')
      .limit(SCAN_LIMIT)
    for (const row of (data ?? []) as Array<{ phone: string | null }>) {
      if (normalizePhone(row.phone) === target) uses++
    }
  }

  // Member yang checkout sebagai guest (ada sesi) — kira juga order /api/orders.
  if (userId) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('promo_code_id', promoId)
      .neq('status', 'cancelled')
    uses += count ?? 0
  }

  return uses
}
