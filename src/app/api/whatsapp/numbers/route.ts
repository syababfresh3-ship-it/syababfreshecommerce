// ============================================================
// api/whatsapp/numbers — urus nombor WhatsApp Official (multi-number).
// GET = senarai nombor + admin (untuk pemilik). POST = tambah. PATCH = kemas.
// DELETE = buang. Admin sahaja. Bila nombor baru ready: POST sini.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function auth() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, sb: null };
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { user: null, sb: null };
  return { user, sb };
}

export async function GET() {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [{ data: numbers }, { data: admins }] = await Promise.all([
    sb.from("wa_numbers").select("phone_number_id, display_name, owner, is_active, is_default, created_at").order("created_at"),
    sb.from("profiles").select("id, full_name").eq("is_admin", true).order("full_name"),
  ]);
  return NextResponse.json({ numbers: numbers ?? [], admins: admins ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const phone_number_id = String(b.phone_number_id ?? "").trim();
  const display_name = String(b.display_name ?? "").trim();
  if (!phone_number_id || !display_name) return NextResponse.json({ error: "phone_number_id & display_name diperlukan." }, { status: 400 });

  if (b.is_default) await sb.from("wa_numbers").update({ is_default: false }).neq("phone_number_id", phone_number_id);
  const { error } = await sb.from("wa_numbers").insert({
    phone_number_id, display_name,
    owner: b.owner || null,
    token: b.token?.trim() || null,
    is_active: b.is_active !== false,
    is_default: !!b.is_default,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.phone_number_id ?? "").trim();
  if (!id) return NextResponse.json({ error: "phone_number_id diperlukan." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("display_name" in b) patch.display_name = String(b.display_name).trim();
  if ("owner" in b) patch.owner = b.owner || null;
  if ("token" in b) patch.token = b.token?.trim() || null;
  if ("is_active" in b) patch.is_active = !!b.is_active;
  if ("is_default" in b && b.is_default) {
    await sb.from("wa_numbers").update({ is_default: false }).neq("phone_number_id", id);
    patch.is_default = true;
  }
  const { error } = await sb.from("wa_numbers").update(patch).eq("phone_number_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("phone_number_id");
  if (!id) return NextResponse.json({ error: "phone_number_id diperlukan." }, { status: 400 });
  await sb.from("wa_numbers").delete().eq("phone_number_id", id);
  return NextResponse.json({ ok: true });
}
