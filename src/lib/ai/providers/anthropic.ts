// ============================================================
// lib/ai/providers/anthropic — Claude (Haiku 5.5 / Sonnet 5.5 / Haiku 4.5) tool-loop.
// Angkat corak dari lib/support/agent.ts: system di-cache, loop tool-use.
// Claude 5.x berfikir dulu (adaptive thinking, lalai) — token fikir DIKIRA dalam max_tokens. Had kecil (≤500)
// boleh terpotong sebelum sempat tulis teks/tool → stop_reason 'max_tokens' tanpa teks = balasan kosong.
// Pengaman: ulang SEKALI dengan bajet 4× bila itu berlaku.
// ============================================================
import Anthropic from "@anthropic-ai/sdk";
import { toAnthropicTools } from "../tools";
import type { ProviderRun } from "../types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY tidak ditetapkan.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const runAnthropicChat: ProviderRun = async ({
  apiModel,
  system,
  history,
  userMessage,
  tools,
  runTool,
  maxIters,
  maxTokens,
}) => {
  const c = getClient();
  const messages: Anthropic.MessageParam[] = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: userMessage },
  ];
  let tokIn = 0;
  let tokOut = 0;
  let cacheRead = 0;
  let cacheCreate = 0;
  let budget = maxTokens;
  let retried = false;
  const usage = () => ({ in: tokIn, out: tokOut, cacheRead, cacheCreate });

  let iters = 0;
  while (iters < maxIters) {
    const resp = await c.messages.create({
      model: apiModel,
      max_tokens: budget,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: tools.length ? (toAnthropicTools(tools) as Anthropic.Tool[]) : undefined,
      messages,
    });
    tokIn += resp.usage.input_tokens ?? 0;
    tokOut += resp.usage.output_tokens ?? 0;
    cacheRead += resp.usage.cache_read_input_tokens ?? 0;
    cacheCreate += resp.usage.cache_creation_input_tokens ?? 0;

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Terpotong sebelum ada teks (biasanya penaakulan + tool call panjang) → ulang sekali, bajet lebih besar.
    if (resp.stop_reason === "max_tokens" && !text && !retried) {
      retried = true;
      budget = Math.min(budget * 4, 8192);
      continue;
    }
    iters++;
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason !== "tool_use") {
      return { text, usage: usage() };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of resp.content) {
      if (block.type === "tool_use") {
        const result = await runTool(block.name, (block.input ?? {}) as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { text: "", usage: usage() };
};
