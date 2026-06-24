// ============================================================
// api/whatsapp/contacts/purchases — semak sejarah beli ikut nombor.
// Padan wa_id (nombor) → lp_guest_orders (phone langsung) + orders (via profiles.phone).
// Pulang: bil. order, jumlah belanja, tarikh order terakhir. Admin sahaja.
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

// Variasi format nombor MY (60-prefix / 0-prefix / bare / +60) untuk padanan.
function phoneVariants(waId: string): string[] {
  const d = (waId || "").replace(/\D/g, "");
  if (!d) return [];
  const core = d.replace(/^60/, "").replace(/^0/, "");
  return [...new Set([d, `60${core}`, `0${core}`, core, `+60${core}`])].filter(Boolean);
}

// "Pernah beli" sebenar = dah bayar ATAU status dah maju (bukan pending-unpaid / cancelled).
const PROGRESSED = ["confirmed", "preparing", "delivering", "delivered"];
const isReal = (o: { status: string; payment_status?: string | null }) =>
  o.payment_status === "paid" || PROGRESSED.includes(o.status);

export async function GET(req: NextRequest) {
  const { user, sb } = await auth();
  if (!user || !sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const waId = new URL(req.url).searchParams.get("waId") || "";
  const variants = phoneVariants(waId);
  if (variants.length === 0) return NextResponse.json({ count: 0, total: 0, lastAt: null });

  // PRIMARY: external_customers (agregat ops = nilai+kekerapan PENUH semua channel).
  // Ops master ada SEMUA order (TikTok + website), jadi ini sumber tunggal — elak double-count.
  const { data: ext } = await sb.from("external_customers").select("order_count, total_spend, last_order_at").in("phone", variants);
  if (ext && ext.length) {
    let count = 0, total = 0;
    let lastAt: string | null = null;
    for (const e of ext as { order_count: number; total_spend: number; last_order_at: string | null }[]) {
      count += Number(e.order_count || 0);
      total += Number(e.total_spend || 0);
      if (e.last_order_at && (!lastAt || e.last_order_at > lastAt)) lastAt = e.last_order_at;
    }
    return NextResponse.json({ count, total, lastAt });
  }

  // FALLBACK: order Supabase native (customer belum wujud dalam ops sync — cth order baru).
  const { data: lp } = await sb.from("lp_guest_orders").select("total, created_at, status, payment_status").in("phone", variants);
  let store: { total: number; created_at: string; status: string; payment_status?: string | null }[] = [];
  const { data: profs } = await sb.from("profiles").select("id").in("phone", variants);
  if (profs && profs.length) {
    const { data } = await sb.from("orders").select("total, created_at, status, payment_status").in("user_id", profs.map((p: { id: string }) => p.id));
    store = (data ?? []) as typeof store;
  }
  const all = [...(lp ?? []), ...store].filter(isReal);
  const count = all.length;
  const total = all.reduce((s: number, o: { total: number }) => s + Number(o.total || 0), 0);
  const lastAt = all.reduce<string | null>((m, o: { created_at: string }) => (!m || o.created_at > m ? o.created_at : m), null);

  return NextResponse.json({ count, total, lastAt });
}
