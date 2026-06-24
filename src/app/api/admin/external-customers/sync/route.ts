// ============================================================
// api/admin/external-customers/sync — sync manual (admin) pembeli channel luar.
// Logik di lib/external-sync. ONE-WAY, additive. Tak sentuh /api/admin/tiktok-sync.
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncExternalCustomers } from "@/lib/external-sync";

async function auth() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, sb: null };
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { user: null, sb: null };
  return { user, sb };
}

export async function POST() {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const r = await syncExternalCustomers(sb);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status ?? 500 });
  return NextResponse.json(r);
}
