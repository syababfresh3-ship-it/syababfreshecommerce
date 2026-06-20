// ============================================================
// api/whatsapp/blast/roas — ROAS per kempen blast (attribution dalaman).
// Baca view crm_blast_roas (lihat 084_crm_blast_roas.sql). Admin sahaja.
// ============================================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sb = createAdminClient();
  const { data: prof } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!prof?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await sb
    .from("crm_blast_roas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ roas: data ?? [] });
}
