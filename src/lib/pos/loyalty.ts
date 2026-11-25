// ============================================================
// Mata loyalty di POS (migration 169). Peraturan SAMA dengan online:
//   kumpul  = floor(jumlah dibayar × pengganda tier), siling 5000 setiap jualan
//   tebus   = 100 mata = RM1; had setiap tiket: ≤ 50% nilai belian & ≤ RM50 (POS_REDEEM_MAX_*)
// Ahli dikenal ikut telefon (pos_loyalty_lookup — 9 digit terakhir). Bukan ahli → mata MENUNGGU
// ikut telefon (loyalty_pending) dan dituntut automatik bila daftar dengan nombor sama (trigger).
// Tolak ralat: migration 169 belum ada → lookup kosong, kumpul dilangkau, tebus ditolak 503.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { round2 } from '@/lib/pos/money'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>

export const POINTS_PER_RM = 100            // 100 mata = RM1 (sama dengan LP_POINTS_RATE)
export const MAX_POINTS_PER_SALE = 5000
export const POS_REDEEM_MAX_PCT = 50        // ≤ 50% nilai belian selepas diskaun & promo
export const POS_REDEEM_MAX_RM = 50         // ≤ RM50 setiap tiket
const MISSING = new Set(['PGRST202', '42883', '42P01', 'PGRST205', '42703'])

export interface PosMember { userId: string; name: string | null; points: number; multiplier: number; pendingPoints: number }

export const pointsToRm = (pts: number) => round2(Math.max(0, Math.floor(pts)) / POINTS_PER_RM)
export const rmToPoints = (rmv: number) => Math.max(0, Math.floor(round2(rmv) * POINTS_PER_RM))
export const earnPoints = (amountPaid: number, multiplier = 1) =>
  Math.min(Math.max(0, Math.floor(Math.max(0, amountPaid) * (multiplier > 0 ? multiplier : 1))), MAX_POINTS_PER_SALE)

/** Had mata boleh ditebus pada satu tiket: baki ahli, 50% nilai belian, RM50 — mana yang paling rendah. */
export function maxRedeemablePoints(balance: number, base: number): number {
  const byPct = rmToPoints(base * POS_REDEEM_MAX_PCT / 100)
  const byRm = rmToPoints(POS_REDEEM_MAX_RM)
  return Math.max(0, Math.min(Math.floor(balance), byPct, byRm))
}

/** Ahli + mata menunggu ikut telefon. null = tiada ahli (pendingPoints tetap dipulangkan dalam .pending). */
export async function lookupMember(sb: SB, phone: string | null | undefined): Promise<{ member: PosMember | null; pending: number; available: boolean }> {
  if (!phone) return { member: null, pending: 0, available: true }
  const { data, error } = await sb.rpc('pos_loyalty_lookup', { p_phone: phone })
  if (error) return { member: null, pending: 0, available: !MISSING.has(error.code ?? '') }
  const row = (Array.isArray(data) ? data[0] : data) as { user_id: string | null; full_name: string | null; total_points: number | null; multiplier: number | null; pending_points: number | null } | undefined
  const pending = Number(row?.pending_points ?? 0) || 0
  if (!row?.user_id) return { member: null, pending, available: true }
  return { member: { userId: row.user_id, name: row.full_name ?? null, points: Number(row.total_points ?? 0) || 0, multiplier: Number(row.multiplier ?? 1) || 1, pendingPoints: pending }, pending, available: true }
}

export interface SaleLoyaltyResult { member: boolean; earned: number; pending: number; balance: number | null; redeemed: number }

/** Selepas jualan DIBAYAR: ahli → kumpul mata (sekali per jualan); bukan ahli dgn telefon → mata menunggu. Best-effort. */
export async function awardSaleLoyalty(sb: SB, sale: { id: string; receipt_no: string | null; total: number; phone: string | null; loyaltyUserId?: string | null; pointsRedeemed?: number }): Promise<SaleLoyaltyResult> {
  const out: SaleLoyaltyResult = { member: false, earned: 0, pending: 0, balance: null, redeemed: sale.pointsRedeemed ?? 0 }
  try {
    const { member, available } = await lookupMember(sb, sale.phone)
    if (!available) return out
    const userId = sale.loyaltyUserId ?? member?.userId ?? null
    if (userId) {
      out.member = true
      const pts = earnPoints(sale.total, member?.multiplier ?? 1)
      const { data, error } = await sb.rpc('pos_loyalty_earn', { p_sale: sale.id, p_user: userId, p_points: pts, p_amount: sale.total, p_receipt: sale.receipt_no })
      if (error) { console.error('[pos-loyalty] earn gagal', error.message); return out }
      out.earned = pts; out.balance = Number(data ?? 0) || 0
      return out
    }
    if (sale.phone) {
      const pts = earnPoints(sale.total, 1)
      const { data, error } = await sb.rpc('pos_loyalty_pending', { p_sale: sale.id, p_phone: sale.phone, p_points: pts, p_receipt: sale.receipt_no })
      if (error) { console.error('[pos-loyalty] pending gagal', error.message); return out }
      out.pending = Number(data ?? 0) || 0
    }
  } catch (e) {
    console.error('[pos-loyalty] ralat', e)
  }
  return out
}

/** Void → balikkan mata diperoleh/ditebus & padam mata menunggu. Best-effort. */
export async function reverseSaleLoyalty(sb: SB, saleId: string): Promise<void> {
  const { error } = await sb.rpc('pos_loyalty_reverse', { p_sale: saleId })
  if (error && !MISSING.has(error.code ?? '')) console.error('[pos-loyalty] reverse gagal', error.message)
}
