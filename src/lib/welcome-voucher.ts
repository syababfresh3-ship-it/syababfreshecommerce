// ============================================================
// Welcome voucher — RM5 untuk order pertama member (min RM30, sah 90 hari, 1x).
// Idempotent: 1 voucher per akaun. Mirror pola refund-baucar (promo_codes).
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>;

const VALUE = 5;
const MIN_ORDER = 30;
const EXPIRY_DAYS = 90;
const PREFIX = "WL"; // tanda voucher welcome

function randomCode(prefix: string, len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I/O/0/1 (elak keliru)
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${s}`;
}

/**
 * Pastikan member ada welcome voucher (cipta kalau belum). Idempotent.
 * Guna admin client (RLS bypass). Return { code } atau null.
 */
export async function ensureWelcomeVoucher(adminSb: SB, userId: string): Promise<{ code: string } | null> {
  // Dah ada? (voucher milik user dengan prefix WL)
  const { data: existing } = await adminSb
    .from("promo_codes")
    .select("code")
    .eq("user_id", userId)
    .ilike("code", `${PREFIX}%`)
    .limit(1)
    .maybeSingle();
  if (existing?.code) return { code: existing.code };

  // Jana kod unik
  let code = randomCode(PREFIX);
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await adminSb.from("promo_codes").select("id").eq("code", code).maybeSingle();
    if (!clash) break;
    code = randomCode(PREFIX);
  }

  const { error } = await adminSb.from("promo_codes").insert({
    code,
    type: "fixed",
    value: VALUE,
    min_order: MIN_ORDER,
    max_uses: 1,
    active: true,
    expires_at: new Date(Date.now() + EXPIRY_DAYS * 86400000).toISOString(),
    user_id: userId,
  });
  if (error) return null;
  return { code };
}
