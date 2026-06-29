// ============================================================
// api/whatsapp/blast/[id] — detail campaign (penerima + progress) & padam.
// GET = blast + recipients + progress. DELETE = buang campaign (recipients cascade).
// Admin sahaja. Additive — tak sentuh route blast sedia ada.
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const { data: blast } = await sb.from("crm_blasts").select("*").eq("id", id).single();
  if (!blast) return NextResponse.json({ error: "Tidak dijumpai." }, { status: 404 });

  const [{ data: recipients }, { data: progress }, { data: attr }] = await Promise.all([
    sb.from("crm_blast_recipients")
      .select("wa_id, name, status, error, sent_at, delivered_at, read_at, created_at")
      .eq("blast_id", id)
      .order("created_at", { ascending: true })
      .limit(5000),
    sb.from("crm_blast_progress").select("*").eq("blast_id", id).maybeSingle(),
    // Order yang dikira ke blast ni (padan nombor, dalam 7 hari) — view 084/085.
    sb.from("crm_blast_order_attribution").select("wa_id, total").eq("blast_id", id),
  ]);

  // Petakan wa_id → {orders, revenue} untuk tunjuk siapa beli.
  const bought: Record<string, { orders: number; revenue: number }> = {};
  for (const a of attr ?? []) {
    const k = (a as { wa_id: string }).wa_id;
    if (!bought[k]) bought[k] = { orders: 0, revenue: 0 };
    bought[k].orders += 1;
    bought[k].revenue += Number((a as { total: number }).total) || 0;
  }
  const recipientsOut = (recipients ?? []).map((r) => ({
    ...r,
    orders: bought[(r as { wa_id: string }).wa_id]?.orders ?? 0,
    revenue: bought[(r as { wa_id: string }).wa_id]?.revenue ?? 0,
  }));

  return NextResponse.json({ blast, recipients: recipientsOut, progress: progress ?? null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  // crm_blast_recipients ada FK on delete cascade → penerima ikut terbuang.
  const { error } = await sb.from("crm_blasts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
