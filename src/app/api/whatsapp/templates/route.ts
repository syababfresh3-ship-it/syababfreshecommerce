// ============================================================
// api/whatsapp/templates — senarai template diluluskan (admin).
// Untuk inbox pilih template bila balas luar window 24j / blast.
// ============================================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates } from "@/lib/whatsapp-cloud";

export async function GET(req: Request) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const all = params.get("all") === "1";

  // Template per-WABA: kalau phoneId diberi, senarai template WABA nombor itu
  // (bukan WABA utama). Untuk blast/balas guna nombor #2 (Syabab Fresh ll).
  const phoneId = params.get("phoneId");
  let waba: string | undefined;
  if (phoneId) {
    const { data: num } = await sb
      .from("wa_numbers")
      .select("waba_id")
      .eq("phone_number_id", phoneId)
      .maybeSingle();
    waba = (num?.waba_id as string | null) || undefined;
  }

  const res = await listTemplates(!all, waba);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ templates: res.templates });
}
