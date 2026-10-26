export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT { facts, action: 'save' | 'verify' | 'unverify' } → simpan draf / sahkan / batal pengesahan.
// DELETE → buang kad fakta (produk kembali "tiada").
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { factsIsEmpty, parseFacts } from "@/lib/ai/product-knowledge";

type Ctx = { params: Promise<{ productId: string }> };
const UUID_RE = /^[0-9a-f-]{36}$/i;
const MISSING = /does not exist|schema cache/i;

export async function PUT(request: Request, { params }: Ctx) {
  const { productId } = await params;
  const { supabase, user, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  if (!UUID_RE.test(productId)) return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { facts?: unknown; action?: string } | null;
  if (!body) return NextResponse.json({ error: "Data tidak sah" }, { status: 400 });
  const action = body.action === "verify" || body.action === "unverify" ? body.action : "save";
  const facts = parseFacts(body.facts);
  if (action === "verify" && factsIsEmpty(facts)) return NextResponse.json({ error: "Isi sekurang-kurangnya satu fakta sebelum sahkan." }, { status: 400 });
  const now = new Date().toISOString();
  const who = user?.email ?? null;
  const sb = supabase!;
  const { data: existing } = await sb.from("product_knowledge").select("status, source, drafted_at, verified_at, verified_by").eq("product_id", productId).maybeSingle();
  const row: Record<string, unknown> = {
    product_id: productId, facts, updated_at: now, updated_by: who,
    source: existing?.source ?? "manual", drafted_at: existing?.drafted_at ?? null,
    status: action === "verify" ? "verified" : action === "unverify" ? "draft" : (existing?.status ?? "draft"),
    verified_at: action === "verify" ? now : action === "unverify" ? null : (existing?.status === "verified" ? existing.verified_at : null),
    verified_by: action === "verify" ? who : action === "unverify" ? null : (existing?.status === "verified" ? existing.verified_by : null),
  };
  // Edit pada kad yang sudah disahkan kekal disahkan (admin yang edit = admin yang bertanggungjawab); dicatat di updated_by.
  const { data, error } = await sb.from("product_knowledge").upsert(row, { onConflict: "product_id" }).select("*").single();
  if (error) return NextResponse.json({ error: MISSING.test(error.message) ? `Jadual pengetahuan belum ada — jalankan migration 151 (${error.message})` : error.message }, { status: 500 });
  return NextResponse.json({ knowledge: { ...data, facts: parseFacts(data.facts) } });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { productId } = await params;
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  if (!UUID_RE.test(productId)) return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
  const { error } = await supabase!.from("product_knowledge").delete().eq("product_id", productId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
