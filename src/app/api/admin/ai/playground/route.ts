// ============================================================
// api/admin/ai/playground — test AI chatbot dalam admin TANPA WhatsApp sebenar.
// Guna persona + knowledge + model yang DISIMPAN (atau override), tools dry-run
// (search_products LIVE, flag_ready_order/get_order TANPA side-effect). Admin only.
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAiChat, type ChatTurn } from "@/lib/ai/chat";
import { buildWaSystemPrompt } from "@/lib/ai/wa-knowledge";
import { WA_TOOLS, makeWaToolRunner } from "@/lib/ai/wa-tools";

export async function POST(req: Request) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    history?: ChatTurn[];
    model?: string;
  };
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message diperlukan." }, { status: 400 });

  // Tetapan disimpan (persona + knowledge + model lalai).
  const { data: rows } = await sb
    .from("app_settings")
    .select("key, value")
    .in("key", ["ai_chatbot_model", "ai_chatbot_knowledge", "ai_chatbot_persona"]);
  const s: Record<string, string> = {};
  for (const r of rows ?? []) s[r.key] = r.value;
  const modelKey = body.model || s.ai_chatbot_model || "gpt-4o-mini";

  // Tool dry-run — search_products LIVE, lain-lain tiada side-effect.
  const toolCalls: { name: string; input: Record<string, unknown>; result: string }[] = [];
  const base = makeWaToolRunner(sb, { waId: "test", dryRun: true });
  const runTool = async (name: string, input: Record<string, unknown>) => {
    const result = await base(name, input);
    toolCalls.push({ name, input, result: result.slice(0, 400) });
    return result;
  };

  try {
    const r = await runAiChat({
      modelKey,
      system: buildWaSystemPrompt({ persona: s.ai_chatbot_persona || "", knowledge: s.ai_chatbot_knowledge || "" }),
      history: Array.isArray(body.history) ? body.history.slice(-12) : [],
      userMessage: message,
      tools: WA_TOOLS,
      runTool,
      maxTokens: 500,
    });
    return NextResponse.json({
      reply: r.text,
      model: r.modelKey,
      usage: r.usage,
      costUsd: r.costUsd,
      tools: toolCalls,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI gagal." }, { status: 502 });
  }
}
