// ============================================================
// lib/ai/providers/anthropic — Claude (claude-haiku-4-5) tool-loop.
// Angkat corak dari lib/support/agent.ts: system di-cache, loop tool-use.
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

  for (let i = 0; i < maxIters; i++) {
    const resp = await c.messages.create({
      model: apiModel,
      max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: tools.length ? (toAnthropicTools(tools) as Anthropic.Tool[]) : undefined,
      messages,
    });
    tokIn += resp.usage.input_tokens ?? 0;
    tokOut += resp.usage.output_tokens ?? 0;
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason !== "tool_use") {
      const text =
        resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim() || "";
      return { text, usage: { in: tokIn, out: tokOut } };
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

  return { text: "", usage: { in: tokIn, out: tokOut } };
};
