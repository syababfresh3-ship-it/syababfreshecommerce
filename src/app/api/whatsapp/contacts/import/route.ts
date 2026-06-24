// ============================================================
// api/whatsapp/contacts/import — import senarai kontak (CSV) ke wa_contacts.
// Upsert ikut wa_id (RPC import_wa_contacts): merge tag, kekal nama asal.
// Daftar tag ke crm_tags (best-effort) supaya muncul dalam filter/blast.
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

export async function POST(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { rows, tag } = body as { rows?: { phone: string; name?: string }[]; tag?: string };
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "Tiada baris untuk import." }, { status: 400 });

  const cleanTag = (tag ?? "").trim();

  // Normalize nombor → wa_id + dedupe (elak ON CONFLICT affect row 2x).
  const seen = new Set<string>();
  const norm: { wa_id: string; name: string | null }[] = [];
  for (const r of rows) {
    const wa_id = formatWaPhone(String(r?.phone ?? ""));
    if (!wa_id || wa_id.replace(/\D/g, "").length < 8) continue;
    if (seen.has(wa_id)) continue;
    seen.add(wa_id);
    norm.push({ wa_id, name: (r?.name ?? "").trim() || null });
  }
  if (norm.length === 0) return NextResponse.json({ error: "Tiada nombor sah dalam senarai." }, { status: 400 });

  // Daftar tag ke crm_tags (best-effort — jangan gagalkan import kalau ralat).
  if (cleanTag) {
    try { await sb.from("crm_tags").upsert({ name: cleanTag }, { onConflict: "name", ignoreDuplicates: true }); } catch { /* abaikan */ }
  }

  // RPC per batch (jsonb).
  let imported = 0;
  const CHUNK = 1000;
  for (let i = 0; i < norm.length; i += CHUNK) {
    const { data, error } = await sb.rpc("import_wa_contacts", { p_rows: norm.slice(i, i + CHUNK), p_tag: cleanTag });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    imported += Number(data ?? 0);
  }

  return NextResponse.json({ ok: true, imported, total: norm.length, tag: cleanTag });
}
