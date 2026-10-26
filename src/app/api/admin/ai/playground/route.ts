// ============================================================
// api/admin/ai/playground — test AI chatbot dalam admin TANPA WhatsApp sebenar.
// Logik dikongsi dengan /api/admin/ai/eval → lib/ai/playground-run.ts. Admin only.
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { runPlaygroundTurn } from "@/lib/ai/playground-run";
import type { ChatTurn } from "@/lib/ai/chat";

export async function POST(req: Request) {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  const body = (await req.json().catch(() => ({}))) as { message?: string; history?: ChatTurn[]; model?: string };
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message diperlukan." }, { status: 400 });
  try {
    const r = await runPlaygroundTurn(supabase!, { message, history: body.history, model: body.model });
    return NextResponse.json({ reply: r.reply, model: r.model, usage: r.usage, costUsd: r.costUsd, tools: r.tools });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI gagal." }, { status: 502 });
  }
}
