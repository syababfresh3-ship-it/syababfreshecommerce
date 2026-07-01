// ============================================================
// Kad Setia — tambah 1 stamp per pembelian. Capai target (9) → auto-issue
// voucher RM{reward} (tebus mana-mana buah sehingga cap) + reset stamp.
// Dipanggil dalam blok idempotent award loyalty (1x per order).
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>;

function randomCode(prefix: string, len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${s}`;
}

/** Tambah 1 stamp untuk member. Bila cukup target → issue voucher ganjaran. Best-effort. */
export async function addStamp(sb: SB, userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  try {
    const { data: rows } = await sb
      .from("app_settings")
      .select("key, value")
      .in("key", ["kad_setia_target", "kad_setia_reward"]);
    const s: Record<string, string> = {};
    for (const r of rows ?? []) s[(r as { key: string }).key] = (r as { value: string }).value;
    const target = Number(s.kad_setia_target ?? "9") || 9;
    const reward = Number(s.kad_setia_reward ?? "15.90") || 15.9;

    const { data: n, error } = await sb.rpc("kad_setia_add_stamp", { p_user: userId });
    if (error || typeof n !== "number") return;

    if (n >= target) {
      // Issue voucher ganjaran (tebus buah sehingga RM{reward})
      let code = randomCode("KS");
      for (let i = 0; i < 5; i++) {
        const { data: clash } = await sb.from("promo_codes").select("id").eq("code", code).maybeSingle();
        if (!clash) break;
        code = randomCode("KS");
      }
      const { error: vErr } = await sb.from("promo_codes").insert({
        code,
        type: "fixed",
        value: reward,
        min_order: 0,
        max_uses: 1,
        active: true,
        expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
        user_id: userId,
      });
      // Hanya tolak stamp kalau voucher berjaya dicipta (elak hilang progress).
      if (!vErr) await sb.rpc("kad_setia_redeem", { p_user: userId, p_target: target });
    }
  } catch {
    /* non-fatal */
  }
}
