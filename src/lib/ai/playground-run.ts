// ============================================================
// lib/ai/playground-run — satu giliran chatbot WA dalam mod UJIAN (tool dry-run: search/details/estimate
// LIVE, flag/remember TANPA kesan). Dikongsi oleh /api/admin/ai/playground dan /api/admin/ai/eval.
// ============================================================
import { runAiChat, type ChatTurn } from "./chat";
import { buildWaSystemPrompt } from "./wa-knowledge";
import { WA_TOOLS, makeWaToolRunner } from "./wa-tools";
import { loadActiveFaqText } from "./product-knowledge";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface PlaygroundToolCall { name: string; input: Record<string, unknown>; result: string }
export interface PlaygroundResult { reply: string; model: string; usage: { in: number; out: number }; costUsd: number; tools: PlaygroundToolCall[] }

export async function runPlaygroundTurn(sb: SB, opts: { message: string; history?: ChatTurn[]; model?: string | null }): Promise<PlaygroundResult> {
  const { data: rows } = await sb.from("app_settings").select("key, value").in("key", ["ai_chatbot_model", "ai_chatbot_knowledge", "ai_chatbot_persona"]);
  const s: Record<string, string> = {};
  for (const r of rows ?? []) s[r.key] = r.value;
  const modelKey = opts.model || s.ai_chatbot_model || "gpt-4o-mini";

  const toolCalls: PlaygroundToolCall[] = [];
  const base = makeWaToolRunner(sb, { waId: "test", dryRun: true });
  const runTool = async (name: string, input: Record<string, unknown>) => {
    const result = await base(name, input);
    toolCalls.push({ name, input, result: result.slice(0, 1500) });   // cukup untuk penilai AI baca hasil tool
    return result;
  };
  const r = await runAiChat({
    modelKey,
    system: buildWaSystemPrompt({ persona: s.ai_chatbot_persona || "", knowledge: s.ai_chatbot_knowledge || "", faq: await loadActiveFaqText(sb) }),
    history: Array.isArray(opts.history) ? opts.history.slice(-12) : [],
    userMessage: opts.message,
    tools: WA_TOOLS,
    runTool,
    maxTokens: 500,
  });
  return { reply: r.text, model: r.modelKey, usage: r.usage, costUsd: r.costUsd, tools: toolCalls };
}
