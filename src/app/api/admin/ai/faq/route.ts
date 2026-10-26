export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// FAQ umum chatbot (ai_faq) — GET senarai · POST { category?, question, answer, is_active?, sort_order? }.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";

const MISSING = /does not exist|schema cache/i;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET() {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  const { data, error } = await supabase!.from("ai_faq").select("*").order("sort_order").order("created_at");
  if (error) return NextResponse.json({ error: MISSING.test(error.message) ? `Jadual FAQ belum ada — jalankan migration 151 (${error.message})` : error.message }, { status: 500 });
  return NextResponse.json({ faq: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Data tidak sah" }, { status: 400 });
  const question = str(b.question, 300), answer = str(b.answer, 1500);
  if (!question || !answer) return NextResponse.json({ error: "Soalan & jawapan diperlukan" }, { status: 400 });
  const row = { category: str(b.category, 60) || null, question, answer, is_active: b.is_active !== false, sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0, updated_by: user?.email ?? null };
  const { data, error } = await supabase!.from("ai_faq").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: MISSING.test(error.message) ? `Jadual FAQ belum ada — jalankan migration 151 (${error.message})` : error.message }, { status: 500 });
  return NextResponse.json({ faq: data });
}
