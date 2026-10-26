export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// FAQ umum — PATCH medan · DELETE.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";

type Ctx = { params: Promise<{ id: string }> };
const UUID_RE = /^[0-9a-f-]{36}$/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const { supabase, user, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Data tidak sah" }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user?.email ?? null };
  if (b.question !== undefined) { const q = str(b.question, 300); if (!q) return NextResponse.json({ error: "Soalan kosong" }, { status: 400 }); patch.question = q; }
  if (b.answer !== undefined) { const a = str(b.answer, 1500); if (!a) return NextResponse.json({ error: "Jawapan kosong" }, { status: 400 }); patch.answer = a; }
  if (b.category !== undefined) patch.category = str(b.category, 60) || null;
  if (b.is_active !== undefined) patch.is_active = !!b.is_active;
  if (b.sort_order !== undefined && Number.isFinite(Number(b.sort_order))) patch.sort_order = Number(b.sort_order);
  const { data, error } = await supabase!.from("ai_faq").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ faq: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID tidak sah" }, { status: 400 });
  const { error } = await supabase!.from("ai_faq").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
