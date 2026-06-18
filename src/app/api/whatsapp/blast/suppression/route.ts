// ============================================================
// api/whatsapp/blast/suppression — senarai suppression (unsubscribe) Blaster.
// GET = senarai (search + tapis source). POST = tambah nombor manual. DELETE = buang.
// Admin sahaja.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWaPhone } from "@/lib/whatsapp-cloud";

async function auth() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { user: null, sb: null };
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return { user: null, sb: null };
  return { user, sb };
}

export async function GET(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const source = url.searchParams.get("source")?.trim();

  let query = sb.from("crm_suppressions").select("id, wa_id, source, note, created_at").order("created_at", { ascending: false }).limit(500);
  if (source) query = query.eq("source", source);
  if (q) query = query.ilike("wa_id", `%${q.replace(/\D/g, "")}%`);
  const { data } = await query;

  // Kiraan ikut sumber (untuk tab/badge).
  const { data: all } = await sb.from("crm_suppressions").select("source");
  const counts = { total: all?.length ?? 0, replied_stop: 0, wa_opt_out: 0, manual: 0 } as Record<string, number>;
  for (const r of all ?? []) counts[r.source] = (counts[r.source] ?? 0) + 1;

  return NextResponse.json({ rows: data ?? [], counts });
}

export async function POST(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { numbers, note } = body as { numbers?: string[]; note?: string };
  if (!Array.isArray(numbers) || numbers.length === 0) return NextResponse.json({ error: "Tiada nombor." }, { status: 400 });

  const rows = numbers
    .map((n) => formatWaPhone(String(n)))
    .filter((w) => w && w.replace(/\D/g, "").length >= 8)
    .map((wa_id) => ({ wa_id, source: "manual", note: note?.trim() || null }));
  if (rows.length === 0) return NextResponse.json({ error: "Nombor tidak sah." }, { status: 400 });

  const { error } = await sb.from("crm_suppressions").upsert(rows, { onConflict: "wa_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, added: rows.length });
}

export async function DELETE(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const waId = url.searchParams.get("wa_id");
  if (!waId) return NextResponse.json({ error: "wa_id diperlukan." }, { status: 400 });
  // Buang dari suppression + nyahaktif opt_out kontak (kalau ada) supaya konsisten.
  await sb.from("crm_suppressions").delete().eq("wa_id", waId);
  await sb.from("wa_contacts").update({ opt_out: false }).eq("wa_id", waId);
  return NextResponse.json({ ok: true });
}
