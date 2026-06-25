// ============================================================
// lib/ai/providers/openai — GPT-4o-mini tool-loop via raw fetch (Chat
// Completions). Guna fetch (tiada pakej SDK baru) supaya tak ganggu deps.
// ============================================================
import { toOpenAiTools } from "../tools";
import type { ProviderRun } from "../types";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

interface OaToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface OaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OaToolCall[];
  tool_call_id?: string;
}

export const runOpenAiChat: ProviderRun = async ({
  apiModel,
  system,
  history,
  userMessage,
  tools,
  runTool,
  maxIters,
  maxTokens,
}) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY tidak ditetapkan.");

  const messages: OaMessage[] = [
    { role: "system", content: system },
    ...history.map((t) => ({ role: t.role, content: t.content }) as OaMessage),
    { role: "user", content: userMessage },
  ];
  const oaTools = tools.length ? toOpenAiTools(tools) : undefined;
  let tokIn = 0;
  let tokOut = 0;

  for (let i = 0; i < maxIters; i++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: apiModel,
        max_tokens: maxTokens,
        messages,
        ...(oaTools ? { tools: oaTools } : {}),
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) {
      throw new Error(j?.error?.message || `OpenAI HTTP ${res.status}`);
    }
    tokIn += j.usage?.prompt_tokens ?? 0;
    tokOut += j.usage?.completion_tokens ?? 0;

    const msg = j.choices?.[0]?.message as OaMessage | undefined;
    if (!msg) return { text: "", usage: { in: tokIn, out: tokOut } };
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) {
      return { text: (msg.content ?? "").trim(), usage: { in: tokIn, out: tokOut } };
    }

    for (const tc of calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function.arguments || "{}");
      } catch {
        input = {};
      }
      const result = await runTool(tc.function.name, input);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }
  }

  return { text: "", usage: { in: tokIn, out: tokOut } };
};
