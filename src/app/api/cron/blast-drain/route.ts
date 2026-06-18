// ============================================================
// /api/cron/blast-drain — drainer kempen Blaster (queue async).
// Dipicu GitHub Actions (~tiap 5 min) dengan Bearer CRON_SECRET. Proses kempen
// 'scheduled'/'sending' yang dah tiba masa, hantar batch penerima time-boxed.
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainBlasts } from "@/lib/blast-drain";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createAdminClient();
  // Bajet < maxDuration supaya fungsi sempat tutup elok; baki di-drain pusingan depan.
  const result = await drainBlasts(sb, { budgetMs: 240_000 });
  return NextResponse.json({ ok: true, ...result });
}
