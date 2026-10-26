export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pengetahuan buah (Fasa 2) — GET senarai produk + status fakta; ?id= → produk + kad fakta penuh.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { parseFacts } from "@/lib/ai/product-knowledge";

const MISSING = /does not exist|schema cache/i;
const missingMsg = (m: string) => `Jadual pengetahuan belum ada — jalankan migration 151 di SQL Editor (${m})`;

export async function GET(request: Request) {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  const sb = supabase!;
  const id = new URL(request.url).searchParams.get("id");

  if (id) {
    const { data: p, error } = await sb
      .from("products")
      .select("id, name, slug, unit, description, categories(name), product_variants(name, is_active, deleted_at, sort_order)")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!p) return NextResponse.json({ error: "Produk tidak dijumpai" }, { status: 404 });
    const { data: k, error: ke } = await sb.from("product_knowledge").select("*").eq("product_id", id).maybeSingle();
    const warning = ke && MISSING.test(ke.message) ? missingMsg(ke.message) : undefined;   // jadual belum ada → masih papar produk
    const variants = ((p.product_variants ?? []) as { name: string; is_active: boolean | null; deleted_at: string | null; sort_order: number | null }[])
      .filter((v) => v.is_active !== false && !v.deleted_at).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((v) => v.name);
    return NextResponse.json({
      product: { id: p.id, name: p.name, slug: p.slug, unit: p.unit, description: p.description ?? "", category: (p.categories as { name?: string } | null)?.name ?? null, variants },
      knowledge: k ? { ...k, facts: parseFacts(k.facts) } : null,
      ...(warning ? { warning } : {}),
    });
  }

  const { data: prods, error } = await sb
    .from("products")
    .select("id, name, slug, description, is_active, show_in_storefront, categories(name)")
    .eq("is_active", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: rows, error: ke } = await sb.from("product_knowledge").select("product_id, status, source, updated_at, updated_by, verified_at, verified_by, facts");
  const warning = ke && MISSING.test(ke.message) ? missingMsg(ke.message) : undefined;   // jadual belum ada → senarai tetap keluar (semua "Tiada")
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of rows ?? []) byId.set(r.product_id, r);
  const products = (prods ?? [])
    .filter((p) => p.show_in_storefront !== false)
    .map((p) => {
      const k = byId.get(p.id);
      const facts = k ? parseFacts(k.facts) : {};
      const filled = Object.keys(facts).filter((x) => x !== "faq").length + (facts.faq?.length ? 1 : 0);
      return {
        id: p.id, name: p.name, slug: p.slug, category: (p.categories as { name?: string } | null)?.name ?? null,
        has_description: !!(p.description && p.description.trim()),
        status: (k?.status as string | undefined) ?? "none", source: (k?.source as string | null) ?? null, filled,
        updated_at: (k?.updated_at as string | null) ?? null, updated_by: (k?.updated_by as string | null) ?? null, verified_by: (k?.verified_by as string | null) ?? null,
      };
    });
  const summary = { total: products.length, verified: products.filter((p) => p.status === "verified").length, draft: products.filter((p) => p.status === "draft").length, none: products.filter((p) => p.status === "none").length };
  return NextResponse.json({ products, summary, ...(warning ? { warning } : {}) });
}
