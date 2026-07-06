// ============================================================
// api/whatsapp/contacts/tags — urus tag CRM (crm_tags).
// DELETE ?name=X          → padam tag. Kalau masih dipakai contact dan
//        &force=1 tiada   → 409 + bilangan (UI confirm dulu).
//        &force=1         → tanggalkan dari semua contact, lepas tu padam.
// Admin sahaja.
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function DELETE(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const name = (req.nextUrl.searchParams.get("name") ?? "").trim();
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!name) return NextResponse.json({ error: "Nama tag diperlukan." }, { status: 400 });

  // Kira contact yang masih pakai tag ni.
  const { count } = await sb
    .from("wa_contacts")
    .select("id", { count: "exact", head: true })
    .contains("tags", [name]);
  const inUse = count ?? 0;

  if (inUse > 0 && !force) {
    return NextResponse.json({ error: "in_use", inUse }, { status: 409 });
  }

  // Tanggalkan tag dari semua contact — paginate (Supabase cap 1000/query).
  if (inUse > 0) {
    const CHUNK = 1000;
    for (;;) {
      // Sentiasa page pertama: setiap update mengecilkan set yang padan.
      const { data, error } = await sb
        .from("wa_contacts")
        .select("id, tags")
        .contains("tags", [name])
        .order("id", { ascending: true })
        .range(0, CHUNK - 1);
      if (error || !data || data.length === 0) break;
      await Promise.all(
        (data as { id: string; tags: string[] | null }[]).map((c) =>
          sb.from("wa_contacts").update({ tags: (c.tags ?? []).filter((t) => t !== name) }).eq("id", c.id)
        )
      );
      if (data.length < CHUNK) break;
    }
  }

  const { error: delErr } = await sb.from("crm_tags").delete().eq("name", name);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, removedFrom: inUse });
}
