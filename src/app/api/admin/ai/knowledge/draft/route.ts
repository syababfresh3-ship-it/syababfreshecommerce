export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { ids: string[] (≤5), overwrite?: boolean, dry?: boolean } → AI jana DRAF kad fakta setiap produk.
// Produk yang sudah 'verified' dilangkau melainkan overwrite=true (draf baharu kekalkan status verified? TIDAK —
// overwrite pada verified menurunkan ke 'draft' supaya admin sahkan semula). dry=true: jana sahaja, tak simpan.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { draftFactsWithAi, parseFacts } from "@/lib/ai/product-knowledge";

const MISSING = /does not exist|schema cache/i;

export async function POST(request: Request) {
  const { supabase, user, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  const body = (await request.json().catch(() => null)) as { ids?: unknown; overwrite?: boolean; dry?: boolean; model?: string } | null;
  const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  if (!ids.length) return NextResponse.json({ error: "ids diperlukan (≤5 setiap panggilan)" }, { status: 400 });
  const sb = supabase!;
  const who = user?.email ?? null;

  const { data: prods, error } = await sb
    .from("products")
    .select("id, name, unit, description, categories(name), product_variants(name, is_active, deleted_at, sort_order)")
    .in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: existing, error: ke } = await sb.from("product_knowledge").select("product_id, status").in("product_id", ids);
  if (ke && MISSING.test(ke.message) && !body?.dry) return NextResponse.json({ error: `Jadual pengetahuan belum ada — jalankan migration 151 (${ke.message})` }, { status: 500 });
  const statusById = new Map<string, string>();
  for (const r of existing ?? []) statusById.set(r.product_id, r.status);

  const results: { id: string; name: string; ok: boolean; skipped?: string; error?: string; costUsd?: number; facts?: unknown }[] = [];
  let total = 0;
  for (const p of prods ?? []) {
    if (statusById.get(p.id) === "verified" && !body?.overwrite) { results.push({ id: p.id, name: p.name, ok: false, skipped: "sudah disahkan" }); continue; }
    const variants = ((p.product_variants ?? []) as { name: string; is_active: boolean | null; deleted_at: string | null; sort_order: number | null }[])
      .filter((v) => v.is_active !== false && !v.deleted_at).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((v) => v.name);
    try {
      const d = await draftFactsWithAi({ name: p.name, category: (p.categories as { name?: string } | null)?.name ?? null, unit: p.unit, variants, description: p.description ?? "" }, body?.model || undefined);
      total += d.costUsd;
      if (body?.dry) { results.push({ id: p.id, name: p.name, ok: true, costUsd: d.costUsd, facts: d.facts }); continue; }
      const now = new Date().toISOString();
      const { error: ue } = await sb.from("product_knowledge").upsert(
        { product_id: p.id, facts: parseFacts(d.facts), status: "draft", source: "ai", drafted_at: now, verified_at: null, verified_by: null, updated_at: now, updated_by: who },
        { onConflict: "product_id" },
      );
      if (ue) throw new Error(MISSING.test(ue.message) ? `jalankan migration 151 (${ue.message})` : ue.message);
      results.push({ id: p.id, name: p.name, ok: true, costUsd: d.costUsd });
    } catch (e) {
      results.push({ id: p.id, name: p.name, ok: false, error: (e as Error).message });
    }
  }
  return NextResponse.json({ results, costUsd: total });
}
