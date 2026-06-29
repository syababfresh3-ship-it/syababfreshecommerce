// ============================================================
// api/whatsapp/blast/[id] — detail campaign (penerima + progress) & padam.
// GET = blast + recipients + progress + attribution "beli" (dikira dlm app,
// tak bergantung view DB supaya status delivered/delivering DIKIRA).
// DELETE = buang campaign. Admin sahaja.
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

// Mirror wa_norm_phone (084): digit sahaja; 0xxx→60xxx; 60xxx→60xxx; else 60+digit.
function normPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const d = String(p).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) return "60" + d.slice(1);
  if (d.startsWith("60")) return d;
  return "60" + d;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Status "real sale" — sepadan dengan kitaran penuh (BUKAN cuma confirmed/paid).
const LP_STATUSES = ["confirmed", "paid", "preparing", "delivering", "delivered"];
const SF_STATUSES = ["confirmed", "preparing", "delivering", "delivered"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const { data: blast } = await sb.from("crm_blasts").select("*").eq("id", id).single();
  if (!blast) return NextResponse.json({ error: "Tidak dijumpai." }, { status: 404 });

  const [{ data: recipients }, { data: progress }] = await Promise.all([
    sb.from("crm_blast_recipients")
      .select("wa_id, name, status, error, sent_at, delivered_at, read_at, created_at")
      .eq("blast_id", id)
      .order("created_at", { ascending: true })
      .limit(5000),
    sb.from("crm_blast_progress").select("*").eq("blast_id", id).maybeSingle(),
  ]);

  // ── Attribution "beli" (dikira dlm app) ──────────────────────────────
  // Padan nombor penerima dgn order (LP + storefront) dlm 7 hari selepas sent_at,
  // status real-sale (termasuk delivered). Ganti view 084/085 yg under-count.
  const sentTimes = (recipients ?? [])
    .map((r) => (r.sent_at ? new Date(r.sent_at).getTime() : null))
    .filter((t): t is number => t != null);

  const bought: Record<string, { orders: number; revenue: number }> = {};

  if (sentTimes.length) {
    const minISO = new Date(Math.min(...sentTimes)).toISOString();
    const maxISO = new Date(Math.max(...sentTimes) + WEEK_MS).toISOString();

    const [{ data: lp }, { data: sfo }] = await Promise.all([
      sb.from("lp_guest_orders").select("phone, total, created_at")
        .in("status", LP_STATUSES).gte("created_at", minISO).lte("created_at", maxISO).limit(10000),
      sb.from("orders").select("user_id, total, created_at")
        .in("status", SF_STATUSES).gte("created_at", minISO).lte("created_at", maxISO).limit(10000),
    ]);

    // Storefront: nombor dari profiles
    const userIds = [...new Set((sfo ?? []).map((o) => o.user_id).filter(Boolean))] as string[];
    const profPhone: Record<string, string | null> = {};
    if (userIds.length) {
      const { data: profs } = await sb.from("profiles").select("id, phone").in("id", userIds);
      for (const p of profs ?? []) profPhone[p.id] = p.phone;
    }

    // phone(normalized) → senarai {masa, total}
    const byPhone: Record<string, { t: number; total: number }[]> = {};
    const push = (phone: string | null | undefined, created_at: string, total: unknown) => {
      const k = normPhone(phone);
      if (!k) return;
      (byPhone[k] ||= []).push({ t: new Date(created_at).getTime(), total: Number(total) || 0 });
    };
    for (const o of lp ?? []) push(o.phone, o.created_at, o.total);
    for (const o of sfo ?? []) push(profPhone[o.user_id as string], o.created_at, o.total);

    for (const r of recipients ?? []) {
      if (!r.sent_at) continue;
      const k = normPhone(r.wa_id);
      if (!k) continue;
      const sent = new Date(r.sent_at).getTime();
      const matches = (byPhone[k] ?? []).filter((o) => o.t >= sent && o.t <= sent + WEEK_MS);
      if (matches.length) {
        bought[r.wa_id] = { orders: matches.length, revenue: matches.reduce((s, o) => s + o.total, 0) };
      }
    }
  }

  const recipientsOut = (recipients ?? []).map((r) => ({
    ...r,
    orders: bought[r.wa_id]?.orders ?? 0,
    revenue: bought[r.wa_id]?.revenue ?? 0,
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
