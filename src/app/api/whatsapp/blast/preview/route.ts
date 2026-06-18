// ============================================================
// api/whatsapp/blast/preview — count + senarai penerima untuk wizard.
// Guna resolveAudience yang SAMA dengan POST → count preview = hantar sebenar.
// Spec preview dihantar TANPA excludeWaIds (wizard urus untick sendiri) supaya
// senarai penuh dipapar untuk checkbox. Admin sahaja.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAudience, type AudienceSpec } from "@/lib/blast-audience";

async function auth() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, sb: null };
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { user: null, sb: null };
  return { user, sb };
}

export async function POST(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const spec = (await req.json().catch(() => ({}))) as AudienceSpec;
  const recipients = await resolveAudience(sb, { ...spec, excludeWaIds: [] });

  // Sampel untuk paparan/untick — cap 2000 (count tetap penuh).
  const contacts = recipients.slice(0, 2000).map((r) => ({ wa_id: r.wa_id, name: r.name, tags: r.tags ?? [] }));
  return NextResponse.json({ count: recipients.length, contacts, capped: recipients.length > 2000 });
}
