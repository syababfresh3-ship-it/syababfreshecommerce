// ============================================================
// api/admin/waitlist/restock — notis restock satu-klik dari waitlist (Sprint 3 G).
// POST { productId, dry?, message?, channels?{wa,email}, templateName?,
//        templateLang?, params?, headerImage?, headerVideo?, phoneNumberId? }
//   dry:true  → pelan sahaja: kiraan penerima (WA vs e-mel), stok, kempen yang
//               BAKAL dicipta, lalai — TIADA tulisan, TIADA hantaran.
//   selainnya → cipta kempen Blaster (bentuk sama wizard) + kick drainer,
//               hantar e-mel, tanda notified_at. Idempotent (baris notified
//               dikecualikan). Admin sahaja (requireAdmin).
// Logik sebenar di lib/waitlist-restock.ts (boleh diuji dry tanpa login).
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { createClient } from "@/lib/supabase/server";
import { executeRestock, planRestock } from "@/lib/waitlist-restock";

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export async function POST(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  const sb = supabase!;

  const b = await req.json().catch(() => ({}));
  const productId = str(b.productId);
  if (!productId) return NextResponse.json({ error: "productId diperlukan." }, { status: 400 });

  const plan = await planRestock(sb, productId);
  if ("error" in plan) return NextResponse.json({ error: plan.error }, { status: plan.status });

  // Pelan awam — kiraan sahaja (nombor/e-mel penuh tak perlu di sheet).
  const publicPlan = {
    product: plan.product,
    stock: plan.stock,
    counts: plan.counts,
    campaign: plan.campaign,
    defaults: plan.defaults,
  };

  if (b.dry === true) return NextResponse.json({ ok: true, dry: true, ...publicPlan });

  // created_by kempen — sama seperti wizard (requireAdmin tak pulangkan user).
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();

  const params: Record<string, string> = {};
  if (b.params && typeof b.params === "object") {
    for (const [k, v] of Object.entries(b.params as Record<string, unknown>)) params[k] = v == null ? "" : String(v);
  }

  const result = await executeRestock(sb, plan, {
    message: str(b.message) ?? plan.defaults.message,
    channels: { wa: b.channels?.wa !== false, email: b.channels?.email !== false },
    templateName: str(b.templateName),
    templateLang: str(b.templateLang) ?? "ms",
    params,
    headerImage: str(b.headerImage) ?? null,
    headerVideo: str(b.headerVideo) ?? null,
    phoneNumberId: str(b.phoneNumberId) ?? null,
    createdBy: user?.id ?? null,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, dry: false, product: plan.product, blastId: result.blastId, counts: { ...plan.counts, ...result.counts } });
}
