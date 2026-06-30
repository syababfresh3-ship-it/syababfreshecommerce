// ============================================================
// /api/cron/auto-followup — hantar nudge follow-up untuk chat terbuka belum beli.
// Dipanggil scheduler luar (cron-job.org / GitHub Actions ~tiap 10-15 min) sebab
// Vercel Hobby cron hanya sekali/hari. Idempotent + time-boxed (≤30s timeout).
// Off-by-default (setting auto_followup_enabled).
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 50;

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAutoFollowup } from "@/lib/auto-followup";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const res = await runAutoFollowup(admin, { budgetMs: 20_000 });
  return NextResponse.json(res);
}
