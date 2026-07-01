// ============================================================
// api/whatsapp/contacts/cleanup-undeliverable — bersih nombor "mati".
// Kesan wa_id yang blast-nya gagal dengan error UNDELIVERABLE (#131026 —
// bukan WhatsApp aktif / tak boleh terima), kemudian masukkan ke
// crm_suppressions supaya auto-dikecualikan dari SEMUA blast masa depan.
// Suppress (bukan padam) → boleh undo, data contact kekal.
//   GET  = pratonton (dry-run): berapa nombor + contoh, TANPA ubah apa-apa.
//   POST = laksana: upsert ke crm_suppressions (source='undeliverable').
// Error template/param (#132xxx/#131008) & tetingkap 24j (#131047) SENGAJA
// dikecualikan — itu bukan nombor tak sah.
// ============================================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function auth() {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return null;
  return sb;
}

// Kumpul wa_id unik yang gagal UNDELIVERABLE (#131026). Paginate supaya selamat
// walau ribuan recipient.
async function collectUndeliverable(sb: ReturnType<typeof createAdminClient>) {
  const set = new Set<string>();
  const CHUNK = 1000;
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await sb
      .from("crm_blast_recipients")
      .select("wa_id")
      .eq("status", "failed")
      .ilike("error", "%131026%")
      .order("id", { ascending: true })
      .range(from, from + CHUNK - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as { wa_id: string }[]) if (r.wa_id) set.add(r.wa_id);
    if (data.length < CHUNK) break;
  }
  // Buang yang sudah pun dalam suppressions (elak double-report).
  if (set.size) {
    const { data: existing } = await sb.from("crm_suppressions").select("wa_id").in("wa_id", [...set]);
    for (const s of (existing ?? []) as { wa_id: string }[]) set.delete(s.wa_id);
  }
  return [...set];
}

export async function GET() {
  const sb = await auth();
  if (!sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const nums = await collectUndeliverable(sb);
  return NextResponse.json({ count: nums.length, sample: nums.slice(0, 20) });
}

export async function POST() {
  const sb = await auth();
  if (!sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const nums = await collectUndeliverable(sb);
  if (!nums.length) return NextResponse.json({ ok: true, suppressed: 0 });
  let suppressed = 0;
  for (let i = 0; i < nums.length; i += 500) {
    const rows = nums.slice(i, i + 500).map((wa_id) => ({ wa_id, source: "undeliverable" }));
    const { error } = await sb.from("crm_suppressions").upsert(rows, { onConflict: "wa_id" });
    if (!error) suppressed += rows.length;
  }
  return NextResponse.json({ ok: true, suppressed });
}
