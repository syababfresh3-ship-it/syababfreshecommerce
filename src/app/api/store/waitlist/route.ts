// ============================================================
// api/store/waitlist — daftar "Bagitahu bila ada" untuk produk habis stok.
// Terbuka (guest boleh), dilindungi burst gate + honeypot (corak order-guard).
// Upsert ikut (product_id, phone) — daftar berulang selamat.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { safeClientIp, isHoneypotFilled } from "@/lib/order-guard";
import { normalizePhone, isValidPhone } from "@/lib/phone";

export async function POST(req: NextRequest) {
  const ip = safeClientIp(req);
  if (!rateLimit("wl:" + (ip ?? "unknown"), 5, 60_000))
    return NextResponse.json({ error: "Terlalu banyak permintaan. Cuba sebentar lagi." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  if (isHoneypotFilled(body)) {
    console.warn(`[order-guard] honeypot hit (waitlist) ip=${ip}`);
    return NextResponse.json({ ok: true });
  }

  const { product_id, phone, name } = body as { product_id?: string; phone?: string; name?: string };
  if (!product_id || typeof product_id !== "string")
    return NextResponse.json({ error: "Produk tidak sah." }, { status: 400 });
  if (!isValidPhone(phone))
    return NextResponse.json({ error: "No. telefon tidak sah." }, { status: 400 });

  const sb = createAdminClient();

  // Pastikan produk wujud (elak spam id rawak).
  const { data: product } = await sb.from("products").select("id").eq("id", product_id).maybeSingle();
  if (!product) return NextResponse.json({ error: "Produk tidak dijumpai." }, { status: 404 });

  // Kalau ada sesi, link user (pilihan — guest kekal boleh).
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();

  const { error } = await sb.from("product_waitlist").upsert(
    {
      product_id,
      phone: normalizePhone(phone),
      name: (name ?? "").trim().slice(0, 120) || null,
      user_id: user?.id ?? null,
    },
    { onConflict: "product_id,phone" },
  );
  if (error) return NextResponse.json({ error: "Gagal daftar. Cuba lagi." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
