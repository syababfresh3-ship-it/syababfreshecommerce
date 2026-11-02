// ============================================================
// api/whatsapp/blast/suppression/review — "Mungkin minta STOP".
// GET = mesej masuk pendek (180 hari) yang sebut stop/berhenti/unsub tapi
// nombornya BELUM disekat. Admin semak & tambah sendiri (tidak auto, sebab
// ayat macam "lupa nak stop kat bank" bukan minta berhenti).
// Admin sahaja. Baca sahaja — tambah guna POST /api/whatsapp/blast/suppression.
// ============================================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPossibleOptOut } from "@/lib/wa-optout";

const DAYS = 180;

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

  const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString();
  const { data: msgs } = await sb
    .from("wa_messages")
    .select("id, contact_id, body, created_at")
    .eq("direction", "in")
    .gte("created_at", since)
    .or("body.ilike.%stop%,body.ilike.%berhenti%,body.ilike.%unsub%")
    .order("created_at", { ascending: false })
    .limit(1000);

  // Satu baris setiap kontak (mesej paling baru), hanya yang lulus isPossibleOptOut.
  const latest = new Map<string, { id: string; body: string; created_at: string }>();
  for (const m of msgs ?? []) {
    if (!m.contact_id || latest.has(m.contact_id) || !isPossibleOptOut(m.body)) continue;
    latest.set(m.contact_id, { id: m.id, body: m.body, created_at: m.created_at });
  }
  if (latest.size === 0) return NextResponse.json({ rows: [] });

  const { data: contacts } = await sb
    .from("wa_contacts")
    .select("id, wa_id, name, opt_out")
    .in("id", [...latest.keys()]);
  const open = (contacts ?? []).filter((c) => !c.opt_out && c.wa_id);

  const { data: supp } = await sb
    .from("crm_suppressions")
    .select("wa_id")
    .in("wa_id", open.map((c) => c.wa_id));
  const blocked = new Set((supp ?? []).map((s) => s.wa_id));

  const rows = open
    .filter((c) => !blocked.has(c.wa_id))
    .map((c) => {
      const m = latest.get(c.id)!;
      return { message_id: m.id, wa_id: c.wa_id as string, name: (c.name as string | null) ?? null, body: m.body, created_at: m.created_at };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json({ rows });
}
