// ============================================================
// api/whatsapp/blast/roas — ROAS per kempen blast (attribution dalaman).
// Baca view crm_blast_roas (lihat 084/085). Dua cara auth:
//   (a) admin cookie (dashboard website), atau
//   (b) header x-internal-token == INTERNAL_API_TOKEN (untuk Man di VPS).
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const sb = createAdminClient();

  // (b) Token dalaman — server-to-server (Man).
  const tok = req.headers.get("x-internal-token");
  const allowInternal = !!tok && !!process.env.INTERNAL_API_TOKEN && tok === process.env.INTERNAL_API_TOKEN;

  // (a) Fallback: admin cookie.
  if (!allowInternal) {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data: prof } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!prof?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await sb
    .from("crm_blast_roas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ roas: data ?? [] });
}
