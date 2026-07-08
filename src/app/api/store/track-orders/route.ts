// ============================================================
// api/store/track-orders — jejak pesanan guest ikut no. telefon (read-only).
// GET ?phone=<raw> → { orders: [{ id, order_number, status, total, created_at }] }
// Identiti = telefon (model sama dgn /api/support/identify & /resit/[id]).
// Pulang medan SELAMAT sahaja (tiada nama/email/alamat).
// TODO: rate-limit (lookup tanpa auth ikut telefon).
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Had kadar: 10 lookup / 60 saat per IP (halang enumerasi telefon).
  if (!rateLimit(`track:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Cuba sebentar lagi." }, { status: 429 });
  }

  const raw = req.nextUrl.searchParams.get("phone") ?? "";
  if (!isValidPhone(raw)) {
    return NextResponse.json({ error: "No. telefon tidak sah" }, { status: 400 });
  }

  const phoneNorm = normalizePhone(raw); // canonical 60xxxxxxxxx
  // lp_guest_orders.phone disimpan pelbagai format — cuba beberapa varian.
  const variants = Array.from(new Set([phoneNorm, "0" + phoneNorm.slice(2), phoneNorm.slice(2), "+" + phoneNorm]));

  const admin = createAdminClient();
  const { data } = await admin
    .from("lp_guest_orders")
    .select("id, order_number, status, total, created_at, phone")
    .in("phone", variants)
    .order("created_at", { ascending: false })
    .limit(20);

  const orders = (data ?? [])
    .filter((o) => normalizePhone((o as { phone: string }).phone) === phoneNorm) // pengesahan ketat
    .map((o) => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total: o.total,
      created_at: o.created_at,
    }));

  return NextResponse.json({ orders });
}
