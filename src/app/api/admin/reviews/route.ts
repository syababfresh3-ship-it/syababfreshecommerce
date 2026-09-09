// ============================================================
// api/admin/reviews — senarai & urus ulasan produk.
// GET = senarai terbaru (+ produk & nama penulis). DELETE ?id= = buang
// ulasan tak sesuai (service role — RLS hanya benarkan penulis padam sendiri).
// Admin sahaja.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { attachReviewerNames } from "@/lib/reviews";

export async function GET() {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  // Embed profiles(full_name) gagal (user_id → auth.users) — nama disambung berasingan.
  const { data } = await supabase!
    .from("product_reviews")
    .select("id, user_id, rating, comment, created_at, products(name, slug, image_url)")
    .order("created_at", { ascending: false })
    .limit(300);

  return NextResponse.json({ reviews: await attachReviewerNames(data ?? []) });
}

export async function DELETE(req: NextRequest) {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;

  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "id diperlukan." }, { status: 400 });

  const { error } = await supabase!.from("product_reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
