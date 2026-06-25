// ============================================================
// api/admin/ai/analytics — ringkasan prestasi AI chatbot dari wa_ai_log.
// Balasan, kos, token, soalan tak terjawab, pecahan ikut model. Admin only.
// ============================================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ROWS = 5000;

export async function GET(req: Request) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const daysParam = Number(new URL(req.url).searchParams.get("days") ?? "30");
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;
  const start = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  const { data: rows, error } = await sb
    .from("wa_ai_log")
    .select("outcome, model, tokens_in, tokens_out, cost_usd, inbound_preview, created_at")
    .gte("created_at", start)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    outcome: string;
    model: string | null;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    inbound_preview: string | null;
    created_at: string;
  };
  const list = (rows ?? []) as Row[];

  const outcomes: Record<string, number> = {};
  const byModel: Record<string, { count: number; cost: number; tokensIn: number; tokensOut: number }> = {};
  let totalCost = 0;
  let totalIn = 0;
  let totalOut = 0;
  const unanswered: { preview: string; outcome: string; created_at: string }[] = [];

  for (const r of list) {
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
    totalCost += Number(r.cost_usd ?? 0);
    totalIn += r.tokens_in ?? 0;
    totalOut += r.tokens_out ?? 0;
    const mk = r.model ?? "—";
    const m = (byModel[mk] ??= { count: 0, cost: 0, tokensIn: 0, tokensOut: 0 });
    m.count += 1;
    m.cost += Number(r.cost_usd ?? 0);
    m.tokensIn += r.tokens_in ?? 0;
    m.tokensOut += r.tokens_out ?? 0;
    if ((r.outcome === "unanswered" || r.outcome === "escalated") && unanswered.length < 30) {
      unanswered.push({ preview: r.inbound_preview ?? "", outcome: r.outcome, created_at: r.created_at });
    }
  }

  const replied = outcomes.replied ?? 0;
  const handled = list.length;

  return NextResponse.json({
    days,
    capped: list.length >= MAX_ROWS,
    handled,
    replied,
    escalated: outcomes.escalated ?? 0,
    unansweredCount: (outcomes.unanswered ?? 0) + (outcomes.escalated ?? 0),
    errors: outcomes.error ?? 0,
    totalCostUsd: totalCost,
    avgTokens: handled ? Math.round((totalIn + totalOut) / handled) : 0,
    byModel,
    unanswered,
  });
}
