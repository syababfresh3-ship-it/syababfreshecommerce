// api/whatsapp/meta-cost — kos WhatsApp SEBENAR dari Meta (pricing_analytics).
// Admin-only. Default 30 hari (max 90 — had analytics Meta).
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { fetchMetaWaCost } from "@/lib/wa-meta-cost";

export async function GET(req: NextRequest) {
  const { forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 86400;

  try {
    const cost = await fetchMetaWaCost(start, end);
    return NextResponse.json({ ok: true, days, ...cost });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gagal tarik kos Meta";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
