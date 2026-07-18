// ============================================================
// api/admin/waitlist — urus waitlist "Bagitahu bila ada".
// GET  = kiraan per produk + senarai penuh (belum notified dulu).
// PATCH = tanda semua entri satu produk sebagai notified (lepas blast).
// Admin sahaja.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";

export async function GET() {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const { data } = await supabase!
    .from("product_waitlist")
    .select("id, product_id, phone, name, notified_at, created_at, products(name, slug, image_url)")
    .order("created_at", { ascending: false })
    .limit(2000);

  return NextResponse.json({ entries: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const b = await req.json().catch(() => ({}));
  const productId = String(b.productId ?? "").trim();
  if (!productId) return NextResponse.json({ error: "productId diperlukan." }, { status: 400 });

  const { error, count } = await supabase!
    .from("product_waitlist")
    .update({ notified_at: new Date().toISOString() }, { count: "exact" })
    .eq("product_id", productId)
    .is("notified_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, marked: count ?? 0 });
}
