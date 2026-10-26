export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// POST { ids?: string[] (≤6), model?: string, judge?: boolean } → jalankan kes ujian chatbot (tool dry-run),
// semakan deterministik (lib/ai/eval-cases.ts) + penilai AI pilihan (Haiku 5.5, skor 0–2 berdasarkan `reference`).
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { EVAL_CASES, evaluateReply } from "@/lib/ai/eval-cases";
import { runPlaygroundTurn } from "@/lib/ai/playground-run";
import { runAiChat } from "@/lib/ai/chat";

const JUDGE_SYSTEM = `Anda penilai kualiti balasan chatbot WhatsApp kedai buah SyababFresh. Nilai balasan berdasarkan FAKTA RUJUKAN dan HASIL TOOL yang diberi.
Skor: 2 = betul, jujur & berguna (tiada rekaan, ikut rujukan/tool); 1 = sebahagian betul atau kurang jelas; 0 = salah, bercanggah dengan rujukan/tool, atau mereka fakta/harga.
Output JSON sahaja: {"score": 0|1|2, "reason": "satu ayat BM"}.`;

export async function POST(request: Request) {
  const { supabase, forbidden } = await requireAdmin();
  if (forbidden) return forbidden;
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown; model?: string; judge?: boolean };
  const wanted = Array.isArray(body.ids) ? new Set((body.ids as unknown[]).filter((x): x is string => typeof x === "string")) : null;
  const cases = (wanted ? EVAL_CASES.filter((c) => wanted.has(c.id)) : EVAL_CASES).slice(0, 6);
  if (!cases.length) return NextResponse.json({ error: "Tiada kes" }, { status: 400 });

  const results = [];
  let cost = 0;
  for (const c of cases) {
    const t0 = Date.now();
    try {
      const r = await runPlaygroundTurn(supabase!, { message: c.q, model: body.model });
      cost += r.costUsd;
      const toolsCalled = r.tools.map((t) => t.name);
      const det = evaluateReply(c, r.reply, toolsCalled);
      let judge: { score: number; reason: string } | null = null;
      let judgeError: string | null = null;
      if (body.judge && c.reference) {
        try {
          const toolSnap = r.tools.map((t) => `${t.name}(${JSON.stringify(t.input)}) → ${t.result.slice(0, 1200)}`).join("\n");
          const j = await runAiChat({ modelKey: "claude-haiku-5-5", system: JUDGE_SYSTEM, userMessage: `SOALAN CUSTOMER: ${c.q}\n\nFAKTA RUJUKAN: ${c.reference}\n\nHASIL TOOL:\n${toolSnap || "(tiada tool)"}\n\nBALASAN AI:\n${r.reply}`, tools: [], maxTokens: 2048, maxIters: 1 });   // Haiku 5.5 berfikir dulu (dikira dalam had) — 200/800 boleh pulang teks kosong
          cost += j.costUsd;
          const m = /\{[\s\S]*\}/.exec(j.text);
          const parsed = m ? (JSON.parse(m[0]) as { score?: unknown; reason?: unknown }) : null;
          if (parsed && [0, 1, 2].includes(Number(parsed.score))) judge = { score: Number(parsed.score), reason: String(parsed.reason ?? "") };
          else judgeError = `output penilai tidak sah: ${j.text.slice(0, 120)}`;
        } catch (e) { judge = null; judgeError = (e as Error).message; }
      }
      results.push({ id: c.id, ok: true, pass: det.pass, checks: det.checks, judge, judgeError, reply: r.reply, tools: r.tools.map((t) => ({ name: t.name, input: t.input })), model: r.model, costUsd: r.costUsd, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ id: c.id, ok: false, pass: false, checks: [], judge: null, judgeError: null, reply: "", tools: [], model: body.model ?? null, costUsd: 0, ms: Date.now() - t0, error: (e as Error).message });
    }
  }
  return NextResponse.json({ results, costUsd: cost });
}
