// ============================================================
// /api/cron/voucher-reminder — email peringatan voucher peribadi hampir
// luput (welcome / kad setia). Harian via cron-job.org, Bearer CRON_SECRET.
// Sekali sahaja per voucher (stamp reminder_sent_at SEBELUM hantar — kalau
// email gagal, rugi satu peringatan; kalau stamp selepas, risiko double-send
// bila timeout. Pilih yang selamat untuk customer). Cap 50/run.
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendVoucherReminderEmail } from "@/lib/zeptomail";
import { stampHeartbeat } from "@/lib/cron-heartbeat";

const WINDOW_DAYS = 7;
const PER_RUN = 50;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);

  // Voucher peribadi, aktif, belum ditebus, luput dalam 7 hari, belum diperingat.
  const { data: vouchers } = await sb
    .from("promo_codes")
    .select("id, code, value, min_order, expires_at, uses_count, user_id, profiles(email, full_name)")
    .not("user_id", "is", null)
    .eq("active", true)
    .eq("uses_count", 0)
    .is("reminder_sent_at", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", windowEnd.toISOString())
    .limit(PER_RUN);

  let sent = 0, skipped = 0;
  for (const v of vouchers ?? []) {
    const prof = v.profiles as unknown as { email: string | null; full_name: string | null } | null;
    if (!prof?.email) {
      // Tiada email → tanda juga (elak scan berulang selamanya).
      await sb.from("promo_codes").update({ reminder_sent_at: now.toISOString() }).eq("id", v.id);
      skipped++;
      continue;
    }
    await sb.from("promo_codes").update({ reminder_sent_at: now.toISOString() }).eq("id", v.id);
    try {
      await sendVoucherReminderEmail({
        to: prof.email,
        customerName: prof.full_name ?? "Pelanggan",
        code: v.code,
        value: Number(v.value),
        minOrder: Number(v.min_order ?? 0),
        expiresAt: v.expires_at,
      });
      sent++;
    } catch (e) {
      console.error(`[voucher-reminder] gagal hantar ${v.code}:`, e);
    }
  }

  await stampHeartbeat(sb, "voucher-reminder");
  return NextResponse.json({ sent, skipped, scanned: vouchers?.length ?? 0 });
}
